import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { CORRECTABLE_STATUSES, EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import type { PublicUser } from "@/lib/auth/users";
import type { ApplicationStatus } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import { applicationDocuments, applicationInstitutions, applications, feePayments, institutions, parameters, programChoices, programs, uploadRequirements } from "@/server/db/schema";
import { newId, nextCounter } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith, requiredText } from "@/server/http/validate";
import { getSettings } from "@/server/modules/settings/settings.service";
import { getFile, signedDownloadUrl, storeUpload } from "@/server/storage/files.service";
import { notify } from "@/server/notifications/notifications.service";
import { applicationFeeFor, currentAcademicYear, listBundleInstitutions, loadApplicationInstitution, maxProgramChoicesFor, type LoadedApplication } from "./applications.queries";
import { readiness, transition } from "./applications.workflow";

/**
 * The applicant's side of applications. Every function starts from the
 * signed-in user and refuses anything that isn't theirs (404, so ids of
 * other applicants' records aren't confirmed to exist).
 */

async function loadOwn(db: Executor, user: PublicUser, applicationInstitutionId: string) {
  const app = await loadApplicationInstitution(db, applicationInstitutionId);
  if (app.application.applicantId !== user.id) throw new NotFoundError("Application");
  return app;
}

function assertEditable(app: { status: string }, statuses: ApplicationStatus[] = EDITABLE_STATUSES) {
  if (!statuses.includes(app.status as ApplicationStatus)) throw new ConflictError("This application has been submitted and can no longer be changed here.");
}

/**
 * After submission, only documents the institution rejected can be
 * replaced; reviewed documents stay as they were.
 */
function assertReplaceable(app: LoadedApplication, requirementId: string) {
  if (EDITABLE_STATUSES.includes(app.status as ApplicationStatus)) return;
  const current = app.documents.find((d) => d.requirementId === requirementId);
  if (current && current.reviewStatus !== "REJECTED") throw new ConflictError("This document has been reviewed and can't be changed now.");
}

/** Shapes an application for the applicant: no internal ids of reviewers, signed links for files. */
async function present(user: PublicUser, app: LoadedApplication) {
  const db = getDb();
  const documents = await Promise.all(
    app.documents.map(async (d) => {
      const file = await getFile(db, d.fileId).catch(() => null);
      return {
        id: d.id,
        requirementId: d.requirementId,
        requirementName: d.requirementName,
        reviewStatus: d.reviewStatus,
        rejectionReason: d.rejectionReason,
        file: file ? { id: file.id, name: file.originalName, size: file.sizeBytes, url: await signedDownloadUrl(user, file) } : null,
        uploadedAt: d.createdAt,
      };
    })
  );
  return {
    id: app.id,
    applicationId: app.applicationId,
    reference: app.reference,
    status: app.status,
    submittedAt: app.submittedAt,
    institution: { id: app.institution.id, name: app.institution.name },
    choices: app.choices,
    requirements: app.requirements.map((r) => ({ id: r.id, name: r.name, description: r.description, required: r.required, fileTypes: r.fileTypes, maxSizeKb: r.maxSizeKb })),
    documents,
    payments: app.payments.map((p) => ({ id: p.id, method: p.method, reference: p.reference, amount: p.amount, applicationFee: p.applicationFee, webFee: p.webFee, paidAt: p.paidAt, approval: p.approval, bankCode: p.bankCode, note: p.note })),
    history: app.events.map((e) => ({ status: e.status, actor: e.actor, note: e.note, at: e.at })),
    readiness: await readiness(db, app),
  };
}

// ---------------------------------------------------------------------------
// The bundle and its institutions
// ---------------------------------------------------------------------------

export async function listMyApplications(user: PublicUser) {
  const db = getDb();
  const bundles = await db.select().from(applications).where(eq(applications.applicantId, user.id)).orderBy(desc(applications.createdAt));
  const rows = await listBundleInstitutions(
    db,
    bundles.map((b) => b.id)
  );
  return bundles.map((b) => ({
    ...b,
    institutions: rows
      .filter((r) => r.ai.applicationId === b.id)
      .map((r) => ({ id: r.ai.id, reference: r.ai.reference, institutionId: r.ai.institutionId, institutionName: r.institutionName, status: r.ai.status, submittedAt: r.ai.submittedAt })),
  }));
}

export async function getMyApplication(user: PublicUser, applicationInstitutionId: string) {
  return present(user, await loadOwn(getDb(), user, applicationInstitutionId));
}

async function ensureBundle(tx: Executor, user: PublicUser) {
  const year = await currentAcademicYear(tx);
  if (!year) throw new ConflictError("Applications aren't open: no academic year is current.");
  const [existing] = await tx
    .select()
    .from(applications)
    .where(and(eq(applications.applicantId, user.id), eq(applications.academicYearId, year.id)))
    .limit(1);
  if (existing) return { bundle: existing, year };
  const seq = await nextCounter(tx, `application:${year.code}`);
  const [bundle] = await tx
    .insert(applications)
    .values({ id: newId("app"), applicantId: user.id, academicYearId: year.id, reference: `AOSA-${year.code.slice(0, 4)}-${String(seq).padStart(5, "0")}` })
    .returning();
  await audit(tx, { action: "create", entityType: "application-bundle", entityId: bundle.id, before: null, after: bundle });
  return { bundle, year };
}

function assertIntakeOpen(year: { attrs: Record<string, unknown> }, allowLate: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  const opens = String(year.attrs.opensOn ?? "");
  const closes = String(year.attrs.closesOn ?? "");
  if (opens && today < opens) throw new ConflictError(`Applications open on ${opens}.`);
  if (closes && today > closes && !allowLate) throw new ConflictError(`Applications closed on ${closes}.`);
}

export async function addInstitution(user: PublicUser, input: unknown) {
  const { institutionId } = parseWith(z.object({ institutionId: requiredText(100) }), input);
  const system = await getSettings("system");
  const db = getDb();
  const id = await db.transaction(async (tx) => {
    const { bundle, year } = await ensureBundle(tx, user);
    assertIntakeOpen(year, system.allowLateSubmissions);

    const [inst] = await tx.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
    if (!inst || inst.status !== "ACTIVE") throw new ValidationError({ institutionId: "Choose an institution that is accepting applications." });

    const existing = await tx.select({ id: applicationInstitutions.id, institutionId: applicationInstitutions.institutionId }).from(applicationInstitutions).where(eq(applicationInstitutions.applicationId, bundle.id));
    if (existing.some((e) => e.institutionId === institutionId)) throw new ConflictError("You've already added this institution.");
    if (existing.length >= system.maxInstitutionsPerApplicant) throw new ConflictError(`You can apply to at most ${system.maxInstitutionsPerApplicant} institutions.`);

    const seq = await nextCounter(tx, `application-institution:${new Date().getUTCFullYear()}`);
    const reference = `APP-${String(new Date().getUTCFullYear()).slice(2)}-${String(seq).padStart(5, "0")}`;
    const aiId = newId("ai");
    await tx.insert(applicationInstitutions).values({ id: aiId, applicationId: bundle.id, institutionId, reference });
    await audit(tx, { action: "create", entityType: "application", entityId: aiId, institutionId, before: null, after: { reference, institutionId } });
    return aiId;
  });
  return getMyApplication(user, id);
}

export async function removeInstitution(user: PublicUser, applicationInstitutionId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    assertEditable(app);
    if (app.payments.some((p) => p.approval !== "REJECTED")) throw new ConflictError("A payment has been recorded for this institution, so it can't be removed.");
    await tx.delete(applicationInstitutions).where(eq(applicationInstitutions.id, app.id));
    await audit(tx, { action: "delete", entityType: "application", entityId: app.id, institutionId: app.institutionId, before: { reference: app.reference }, after: null });
  });
}

// ---------------------------------------------------------------------------
// Program choices and documents
// ---------------------------------------------------------------------------

export async function setProgramChoices(user: PublicUser, applicationInstitutionId: string, input: unknown) {
  const { choices } = parseWith(
    z.object({
      choices: z
        .array(z.object({ programId: requiredText(100), rank: z.number().int().min(1).max(3) }))
        .max(3)
        .refine((c) => new Set(c.map((x) => x.rank)).size === c.length, "Each rank can only be used once.")
        .refine((c) => new Set(c.map((x) => x.programId)).size === c.length, "Choose each program only once."),
    }),
    input
  );
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    assertEditable(app);
    const max = await maxProgramChoicesFor(tx, app.institutionId);
    if (choices.length > max) throw new ValidationError({ choices: `${app.institution.name} accepts up to ${max} program choice${max === 1 ? "" : "s"}.` });
    const ranks = choices.map((c) => c.rank).sort();
    if (ranks.some((r, i) => r !== i + 1)) throw new ValidationError({ choices: "Rank your choices 1, 2, 3 without gaps." });

    if (choices.length) {
      const found = await tx
        .select({ id: programs.id })
        .from(programs)
        .where(and(inArray(programs.id, choices.map((c) => c.programId)), eq(programs.institutionId, app.institutionId), eq(programs.status, "ACTIVE")));
      if (found.length !== choices.length) throw new ValidationError({ choices: "Choose programs this institution currently offers." });
    }

    await tx.delete(programChoices).where(eq(programChoices.applicationInstitutionId, app.id));
    if (choices.length) await tx.insert(programChoices).values(choices.map((c) => ({ id: newId("pc"), applicationInstitutionId: app.id, programId: c.programId, rank: c.rank })));
    await audit(tx, { action: "update", entityType: "program-choices", entityId: app.id, institutionId: app.institutionId, before: { choices: app.choices.map((c) => ({ programId: c.programId, rank: c.rank })) }, after: { choices } });
  });
  return getMyApplication(user, applicationInstitutionId);
}

export async function uploadDocument(user: PublicUser, applicationInstitutionId: string, form: FormData) {
  const requirementId = String(form.get("requirementId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) throw new ValidationError({ file: "Choose a file to upload." });
  const db = getDb();
  const app = await loadOwn(db, user, applicationInstitutionId);
  assertEditable(app, CORRECTABLE_STATUSES);
  const [requirement] = await db
    .select()
    .from(uploadRequirements)
    .where(and(eq(uploadRequirements.id, requirementId), eq(uploadRequirements.institutionId, app.institutionId), eq(uploadRequirements.status, "ACTIVE")))
    .limit(1);
  if (!requirement) throw new ValidationError({ requirementId: "Choose one of this institution's document requirements." });
  assertReplaceable(app, requirement.id);

  // Stored with the institution id so its staff can open it once submitted.
  const stored = await storeUpload({ owner: user, file, purpose: "application-document", institutionId: app.institutionId, allowedTypes: requirement.fileTypes, maxSizeKb: requirement.maxSizeKb });
  await db.transaction(async (tx) => {
    // One document per requirement: a new upload replaces the previous one.
    await tx.delete(applicationDocuments).where(and(eq(applicationDocuments.applicationInstitutionId, app.id), eq(applicationDocuments.requirementId, requirement.id)));
    await tx.insert(applicationDocuments).values({ id: newId("doc"), applicationInstitutionId: app.id, requirementId: requirement.id, requirementName: requirement.name, fileId: stored.id });
    await audit(tx, { action: "upload", entityType: "application-document", entityId: app.id, institutionId: app.institutionId, meta: { requirement: requirement.name, fileId: stored.id } });
  });
  return getMyApplication(user, applicationInstitutionId);
}

export async function removeDocument(user: PublicUser, applicationInstitutionId: string, documentId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    assertEditable(app, CORRECTABLE_STATUSES);
    const doc = app.documents.find((d) => d.id === documentId);
    if (doc?.requirementId) assertReplaceable(app, doc.requirementId);
    const [deleted] = await tx
      .delete(applicationDocuments)
      .where(and(eq(applicationDocuments.id, documentId), eq(applicationDocuments.applicationInstitutionId, app.id)))
      .returning();
    if (!deleted) throw new NotFoundError("Document");
    await audit(tx, { action: "delete", entityType: "application-document", entityId: app.id, institutionId: app.institutionId, meta: { requirement: deleted.requirementName } });
  });
  return getMyApplication(user, applicationInstitutionId);
}

// ---------------------------------------------------------------------------
// Fee payment, submission, offer response
// ---------------------------------------------------------------------------

export async function recordFeePayment(user: PublicUser, applicationInstitutionId: string, input: unknown) {
  const v = parseWith(
    z.object({
      method: requiredText(100),
      paymentMethodId: z.string().trim().max(100).optional(),
      reference: requiredText(80),
      paidAt: z.iso.date().or(z.iso.datetime()),
      receiptFileId: z.string().trim().max(100).optional(),
    }),
    input
  );
  const payment = await getSettings("payment");
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    assertEditable(app);
    if (app.payments.some((p) => p.approval === "APPROVED")) throw new ConflictError("The fee for this application has already been approved.");
    if (app.payments.some((p) => p.approval === "AWAITING")) throw new ConflictError("A payment is already awaiting approval for this application.");
    if (new Date(v.paidAt) > new Date()) throw new ValidationError({ paidAt: "The payment date can't be in the future." });
    if (payment.requireReceipt && !v.receiptFileId) throw new ValidationError({ receiptFileId: "Upload the payment receipt." });
    if (v.receiptFileId) {
      const file = await getFile(tx, v.receiptFileId);
      if (file.ownerUserId !== user.id || file.purpose !== "payment-receipt") throw new ValidationError({ receiptFileId: "Upload the receipt again." });
    }
    const [method] = await tx.select({ id: parameters.id }).from(parameters).where(and(eq(parameters.id, v.method), eq(parameters.category, "payment-method-types"))).limit(1);
    if (!method || !payment.allowedMethodIds.includes(v.method)) throw new ValidationError({ method: "Choose one of the payment channels offered." });

    // The amount is worked out here, never taken from the request.
    const applicationFee = await applicationFeeFor(tx, app.institutionId);
    const webFee = app.institution.webFee;
    const id = newId("fee");
    await tx.insert(feePayments).values({
      id,
      applicationInstitutionId: app.id,
      method: v.method,
      paymentMethodId: v.paymentMethodId ?? null,
      reference: v.reference,
      receiptFileId: v.receiptFileId ?? null,
      applicationFee,
      webFee,
      amount: applicationFee + webFee,
      paidAt: new Date(v.paidAt),
    });
    await audit(tx, { action: "create", entityType: "fee-payment", entityId: id, institutionId: app.institutionId, meta: { reference: v.reference, amount: applicationFee + webFee } });
    await notify(tx, { audience: "admin", category: "PAYMENT", title: `Payment to approve: ${app.reference}`, summary: `${v.reference}, ${applicationFee + webFee} XAF.`, reference: app.reference, action: { label: "Review payments", href: "/admin/payments" } });
  });
  return getMyApplication(user, applicationInstitutionId);
}

export async function submitApplication(user: PublicUser, applicationInstitutionId: string, input: unknown) {
  parseWith(z.object({ declaration: z.literal(true, "Confirm the declaration to submit.") }), input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    const check = await readiness(tx, app);
    if (!check.ready) {
      throw new ValidationError(Object.fromEntries(check.checks.filter((c) => !c.ok).map((c) => [c.key, c.detail])), "This application isn't ready to submit.");
    }
    if (app.status === "I_REJECTED") {
      // Only rejections whose reason allows it ("Correct and resubmit") can come back.
      const rejection = [...app.events].reverse().find((e) => e.status === "I_REJECTED");
      const [reason] = rejection?.reasonId ? await tx.select({ attrs: parameters.attrs }).from(parameters).where(eq(parameters.id, rejection.reasonId)).limit(1) : [];
      if (reason?.attrs?.resubmit !== true) throw new ConflictError("This rejection is final; the application can't be resubmitted.");
    }
    const to: ApplicationStatus = app.status === "I_REJECTED" || app.status === "I_ACKNOWLEDGED" ? "RESUBMITTED" : "SUBMITTED";
    await transition(tx, app, to, "applicant", { actorUserId: user.id });
  });
  return getMyApplication(user, applicationInstitutionId);
}

export async function respondToOffer(user: PublicUser, applicationInstitutionId: string, input: unknown) {
  const { decision } = parseWith(z.object({ decision: z.enum(["accept", "decline"]) }), input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    if (app.status !== "ACCEPTED") throw new ForbiddenError("There's no offer to answer on this application.");
    await transition(tx, app, decision === "accept" ? "A_ACKNOWLEDGED" : "A_REJECTED", "applicant", { actorUserId: user.id });
  });
  return getMyApplication(user, applicationInstitutionId);
}
