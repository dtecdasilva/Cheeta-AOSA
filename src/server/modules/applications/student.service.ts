import "server-only";
import { assertAcceptingApplications, stateOf } from "@/server/modules/institutions/applicationWindow.service";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { CORRECTABLE_STATUSES, EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import { DECLARATION_VERSION } from "@/lib/applications/declaration";
import type { PublicUser } from "@/lib/auth/users";
import type { ApplicationStatus } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import { applicationDocuments, applicationInstitutions, applicationStatusEvents, applications, feePayments, institutionPaymentMethods, institutions, parameters, programChoices, programs, uploadRequirements } from "@/server/db/schema";
import { newId, nextCounter } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith, requiredText } from "@/server/http/validate";
import { PAYMENT_METHOD_CHANNEL, type PaymentMethodType } from "@/lib/institution/paymentMethods";
import { getSettings } from "@/server/modules/settings/settings.service";
import { platformMaxUploadKb } from "@/server/modules/institutions/institutions.resources";
import { loadSnapshots, presentSnapshot, quoteRate, takeSnapshot } from "@/server/modules/reference/conversion.service";
import { allowedChannels, savedDisplayCurrency } from "@/server/modules/fees/studentFees.service";
import { discardBytes, fileUrl, getFile, markFilesDeleted, storeUpload, type StoredFile } from "@/server/storage/files.service";
import { notify } from "@/server/notifications/notifications.service";
import { admissionFor, recordOfferResponse } from "@/server/modules/deliberation/admissions.service";
import { assessApplicationFee, currentAcademicYear, listBundleInstitutions, loadApplicationInstitution, maxProgramChoicesFor, type LoadedApplication } from "./applications.queries";
import { readiness, syncCompletion, transition } from "./applications.workflow";

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

/** Shapes an application for the applicant: no internal ids of reviewers, and each file as the address the applicant opens it at. */
async function present(user: PublicUser, app: LoadedApplication) {
  const db = getDb();
  const snapshots = await loadSnapshots(db, app.payments.flatMap((p) => [p.feeRateSnapshotId, p.displayRateSnapshotId]));
  const stored = (id: string | null) => (id && snapshots.has(id) ? presentSnapshot(snapshots.get(id)!) : null);
  const fileOf = async (id: string | null) => {
    const file = id ? await getFile(db, id).catch(() => null) : null;
    return file ? { id: file.id, name: file.originalName, size: file.sizeBytes, url: fileUrl(file) } : null;
  };
  const documents = await Promise.all(
    app.documents.map(async (d) => ({
      id: d.id,
      requirementId: d.requirementId,
      requirementName: d.requirementName,
      documentTypeId: d.documentTypeId,
      reviewStatus: d.reviewStatus,
      rejectionReason: d.rejectionReason,
      file: await fileOf(d.fileId),
      uploadedAt: d.createdAt,
    }))
  );
  const receipts = new Map(await Promise.all(app.payments.map(async (p) => [p.id, await fileOf(p.receiptFileId)] as const)));
  const submission = await submissionState(db, app);
  return {
    id: app.id,
    applicationId: app.applicationId,
    reference: app.reference,
    /** The Application ID, issued on first submission; null before. */
    applicationNumber: app.applicationNumber,
    status: app.status,
    submittedAt: app.submittedAt,
    declarationAcceptedAt: app.declarationAcceptedAt,
    institution: { id: app.institution.id, name: app.institution.name },
    // What the applicant may still do here, so screens offer only what the server will accept:
    // before submission anything can change; once the institution has sent it back, documents can.
    canEdit: EDITABLE_STATUSES.includes(app.status as ApplicationStatus),
    canUploadDocuments: CORRECTABLE_STATUSES.includes(app.status as ApplicationStatus),
    maxProgramChoices: await maxProgramChoicesFor(db, app.institutionId),
    choices: app.choices,
    // The size limit shown is the one the upload will be held to: the requirement's, or the platform's if that is lower.
    requirements: app.requirements.map((r) => ({ id: r.id, documentTypeId: r.documentTypeId, name: r.name, description: r.description, required: r.required, fileTypes: r.fileTypes, maxSizeKb: Math.min(r.maxSizeKb, platformMaxUploadKb()) })),
    documents,
    // Each payment as it was recorded: its amounts in its base currency, and the conversions stored with it
    // (fee currency to base, base to the currency the applicant was viewing). Null where nothing was converted.
    // `approval` is where verification stands; it is never APPROVED until Cheeta administration has approved it.
    payments: app.payments.map((p) => ({
      id: p.id,
      method: p.method,
      paymentMethodId: p.paymentMethodId,
      paymentAccount: p.paymentAccount,
      reference: p.reference,
      paidFrom: p.paidFrom,
      currency: p.currency,
      amount: p.amount,
      applicationFee: p.applicationFee,
      webFee: p.webFee,
      feeConversion: stored(p.feeRateSnapshotId),
      displayConversion: stored(p.displayRateSnapshotId),
      paidAt: p.paidAt,
      submittedAt: p.submittedAt,
      receipt: receipts.get(p.id) ?? null,
      approval: p.approval,
      verifiedAt: p.reviewedAt,
      rejectionReason: p.approval === "REJECTED" ? p.rejectionReason : null,
      bankCode: p.bankCode,
    })),
    history: app.events.map((e) => ({ status: e.status, actor: e.actor, note: e.note, at: e.at })),
    // The institution's own check that the fee reached its account, once it has made it.
    institutionPaymentCheck: app.paymentVerification === "PENDING" ? null : { result: app.paymentVerification, note: app.paymentVerificationNote, at: app.paymentVerifiedAt },
    // Comments the institution chose to share with the applicant; its internal ones never leave the institution.
    comments: app.comments.filter((c) => c.visibleToApplicant).map((c) => ({ id: c.id, body: c.body, at: c.createdAt })),
    readiness: await readiness(db, app, { resubmission: submission.mode === "resubmit" }),
    // The place offered by deliberation, if there is one.
    admission: await admissionFor(db, app.id),
    submission,
  };
}

/**
 * Whether the application can be sent to the institution now, and as
 * what: a first submission (before it has ever been sent), or a
 * resubmission of a correction the institution asked for. Null `mode`
 * means it can't be, and `reason` says why.
 */
async function submissionState(db: Executor, app: LoadedApplication): Promise<{ mode: "submit" | "resubmit" | null; reason: string | null; declarationVersion: string }> {
  const out = (mode: "submit" | "resubmit" | null, reason: string | null) => ({ mode, reason, declarationVersion: DECLARATION_VERSION });
  const status = app.status as ApplicationStatus;
  if (EDITABLE_STATUSES.includes(status)) {
    // A first submission only while the institution is accepting applications. (Corrections it asked for, below, still go.)
    const [inst] = await db.select().from(institutions).where(eq(institutions.id, app.institutionId)).limit(1);
    const window = inst ? stateOf(inst) : null;
    return window && !window.open ? out(null, window.reason) : out("submit", null);
  }
  const sent = app.applicationNumber ? ` as ${app.applicationNumber}` : "";
  if (status === "I_REJECTED") {
    // Only a rejection whose reason allows it ("correct and resubmit") can be answered with a correction.
    const rejection = [...app.events].reverse().find((e) => e.status === "I_REJECTED");
    const [reason] = rejection?.reasonId ? await db.select({ attrs: parameters.attrs }).from(parameters).where(eq(parameters.id, rejection.reasonId)).limit(1) : [];
    return reason?.attrs?.resubmit === true ? out("resubmit", null) : out(null, "The institution's rejection is final, so this application can't be sent again.");
  }
  if (status === "I_ACKNOWLEDGED") {
    // After acknowledging, the institution can still reject a document; sending the replacement back is a resubmission.
    const acknowledged = [...app.events].reverse().find((e) => e.status === "I_ACKNOWLEDGED");
    const replaced = app.documents.some((d) => acknowledged && d.createdAt > acknowledged.at);
    return replaced ? out("resubmit", null) : out(null, `Already submitted${sent} and acknowledged by the institution. There is nothing new to send.`);
  }
  if (status === "SUBMITTED" || status === "RESUBMITTED") return out(null, `Already submitted${sent}${app.submittedAt ? ` on ${app.submittedAt.toISOString().slice(0, 10)}` : ""}. It is waiting for the institution's review.`);
  return out(null, "This application has been decided and can't be submitted again.");
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

/** Every institution the applicant has applied to, each in full (choices, documents, payments, checklist), oldest first. */
export async function listMyApplicationsInFull(user: PublicUser) {
  const db = getDb();
  const rows = await db
    .select({ id: applicationInstitutions.id })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .where(eq(applications.applicantId, user.id))
    .orderBy(asc(applicationInstitutions.createdAt));
  const out = [];
  for (const row of rows) out.push(await present(user, await refreshed(db, row.id)));
  return out;
}

/**
 * The application with its INCOMPLETE/COMPLETED status brought up to date
 * first. Most changes that affect it sync it as they happen; this catches
 * the ones made by others (an institution adding a required document,
 * withdrawing a program, an intake closing), so the applicant never sees
 * a status the checklist contradicts.
 */
async function refreshed(db: Executor, applicationInstitutionId: string) {
  return db.transaction((tx) => syncCompletion(tx, applicationInstitutionId));
}

export type MyApplicationView = Awaited<ReturnType<typeof listMyApplicationsInFull>>[number];

export async function getMyApplication(user: PublicUser, applicationInstitutionId: string) {
  const db = getDb();
  await loadOwn(db, user, applicationInstitutionId);
  return present(user, await refreshed(db, applicationInstitutionId));
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
    await assertAcceptingApplications(tx, institutionId);

    const existing = await tx.select({ id: applicationInstitutions.id, institutionId: applicationInstitutions.institutionId }).from(applicationInstitutions).where(eq(applicationInstitutions.applicationId, bundle.id));
    if (existing.some((e) => e.institutionId === institutionId)) throw new ConflictError("You've already added this institution.");
    if (existing.length >= system.maxInstitutionsPerApplicant) throw new ConflictError(`You can apply to at most ${system.maxInstitutionsPerApplicant} institutions.`);

    const seq = await nextCounter(tx, `application-institution:${new Date().getUTCFullYear()}`);
    const reference = `APP-${String(new Date().getUTCFullYear()).slice(2)}-${String(seq).padStart(5, "0")}`;
    const aiId = newId("ai");
    await tx.insert(applicationInstitutions).values({ id: aiId, applicationId: bundle.id, institutionId, reference });
    await assessApplicationFee(tx, { id: aiId, institutionId, webFee: inst.webFee });
    await audit(tx, { action: "create", entityType: "application", entityId: aiId, institutionId, before: null, after: { reference, institutionId } });
    // The first status event: it starts INCOMPLETE (nothing chosen or uploaded yet).
    await tx.insert(applicationStatusEvents).values({ id: newId("evt"), applicationInstitutionId: aiId, status: "INCOMPLETE", actor: "applicant", actorUserId: user.id, note: "Institution added to the application." });
    return aiId;
  });
  return getMyApplication(user, id);
}

export async function removeInstitution(user: PublicUser, applicationInstitutionId: string) {
  const db = getDb();
  const removed = await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    assertEditable(app);
    if (app.payments.some((p) => p.approval !== "REJECTED")) throw new ConflictError("A payment has been recorded for this institution, so it can't be removed.");
    await tx.delete(applicationInstitutions).where(eq(applicationInstitutions.id, app.id));
    await audit(tx, { action: "delete", entityType: "application", entityId: app.id, institutionId: app.institutionId, before: { reference: app.reference }, after: null });
    // The application's documents went with it, so their files go too, and so do the receipts of its
    // (rejected) payments unless a payment elsewhere still uses one.
    const receiptIds = app.payments.map((p) => p.receiptFileId).filter((id): id is string => !!id);
    const stillUsed = receiptIds.length ? await tx.select({ id: feePayments.receiptFileId }).from(feePayments).where(inArray(feePayments.receiptFileId, receiptIds)) : [];
    const kept = new Set(stillUsed.map((r) => r.id));
    return markFilesDeleted(tx, [...app.documents.map((d) => d.fileId), ...receiptIds.filter((id) => !kept.has(id))]);
  });
  await discardBytes(removed);
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
    await syncCompletion(tx, app.id);
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

  const stored = await storeUpload({ owner: user, file, purpose: "application-document", institutionId: app.institutionId, allowedTypes: requirement.fileTypes, maxSizeKb: requirement.maxSizeKb });
  let replaced: StoredFile[];
  try {
    replaced = await db.transaction(async (tx) => {
      // One document per requirement: a new upload replaces the previous one.
      const previous = await tx
        .delete(applicationDocuments)
        .where(and(eq(applicationDocuments.applicationInstitutionId, app.id), eq(applicationDocuments.requirementId, requirement.id)))
        .returning({ fileId: applicationDocuments.fileId });
      // Whose the document is and what it is for come from the application it is uploaded to, never from the request.
      await tx.insert(applicationDocuments).values({
        id: newId("doc"),
        applicationInstitutionId: app.id,
        applicantId: app.application.applicantId,
        applicationId: app.applicationId,
        institutionId: app.institutionId,
        requirementId: requirement.id,
        requirementName: requirement.name,
        documentTypeId: requirement.documentTypeId,
        fileId: stored.id,
      });
      await audit(tx, { action: "upload", entityType: "application-document", entityId: app.id, institutionId: app.institutionId, meta: { requirement: requirement.name, documentTypeId: requirement.documentTypeId, fileId: stored.id } });
      const retired = await markFilesDeleted(tx, previous.map((d) => d.fileId));
      await syncCompletion(tx, app.id);
      return retired;
    });
  } catch (err) {
    // The file is stored but attached to nothing: take it away again rather than leave it lying.
    await discardBytes(await markFilesDeleted(db, [stored.id]));
    throw err;
  }
  await discardBytes(replaced);
  return getMyApplication(user, applicationInstitutionId);
}

export async function removeDocument(user: PublicUser, applicationInstitutionId: string, documentId: string) {
  const db = getDb();
  const removed = await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    assertEditable(app, CORRECTABLE_STATUSES);
    const doc = app.documents.find((d) => d.id === documentId);
    if (doc?.requirementId) assertReplaceable(app, doc.requirementId);
    const [deleted] = await tx
      .delete(applicationDocuments)
      .where(and(eq(applicationDocuments.id, documentId), eq(applicationDocuments.applicationInstitutionId, app.id)))
      .returning();
    if (!deleted) throw new NotFoundError("Document");
    await audit(tx, { action: "delete", entityType: "application-document", entityId: app.id, institutionId: app.institutionId, meta: { requirement: deleted.requirementName, fileId: deleted.fileId } });
    await syncCompletion(tx, app.id);
    // Removed from the application means removed: the file opens for nobody from here on.
    return markFilesDeleted(tx, [deleted.fileId]);
  });
  await discardBytes(removed);
  return getMyApplication(user, applicationInstitutionId);
}

// ---------------------------------------------------------------------------
// Fee payment, submission, offer response
// ---------------------------------------------------------------------------

const paymentSchema = z
  .object({
    /** The institution account paid into. With it, the channel can be left out: it follows from the kind of account. */
    paymentMethodId: z.string().trim().max(100).optional(),
    /** A payment channel from the platform's "Payment method types" list. */
    method: z.string().trim().max(100).optional(),
    reference: requiredText(80),
    /** The number, wallet or person the money was sent from, to help match it. */
    paidFrom: z.string().trim().max(120).optional(),
    paidAt: z.iso.date({ error: "Enter the date you paid." }).or(z.iso.datetime({ error: "Enter the date you paid." })),
    receiptFileId: z.string().trim().max(100).optional(),
  })
  .refine((v) => v.paymentMethodId || v.method, { path: ["paymentMethodId"], message: "Choose the account you paid into." });

/**
 * Records an application fee the applicant has paid outside the platform.
 *
 * The amount is worked out here, never taken from the request, and this
 * is the moment its figures become permanent: the fee as the institution
 * scheduled it, the exchange rate it was converted to the base currency
 * at, the rate and converted amount in the currency the applicant was
 * viewing, and the account paid into are all stored with the payment.
 * Nothing recalculates them afterwards.
 */
export async function recordFeePayment(user: PublicUser, applicationInstitutionId: string, input: unknown) {
  const v = parseWith(paymentSchema, input);
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

    // The account must be one of this institution's that applicants are shown: active, and verified by Cheeta administration.
    let account: typeof institutionPaymentMethods.$inferSelect | null = null;
    if (v.paymentMethodId) {
      [account = null] = await tx
        .select()
        .from(institutionPaymentMethods)
        .where(and(eq(institutionPaymentMethods.id, v.paymentMethodId), eq(institutionPaymentMethods.institutionId, app.institutionId), eq(institutionPaymentMethods.status, "ACTIVE"), eq(institutionPaymentMethods.verification, "VERIFIED")))
        .limit(1);
      if (!account) throw new ValidationError({ paymentMethodId: "Choose one of this institution's payment accounts." });
    }

    const channels = await allowedChannels(tx, payment.allowedMethodIds);
    const wanted = account ? PAYMENT_METHOD_CHANNEL[account.type as PaymentMethodType] : null;
    let channel = v.method ? channels.find((c) => c.id === v.method) : undefined;
    if (v.method && !channel) throw new ValidationError({ method: "Choose one of the payment channels offered." });
    if (channel && wanted && channel.channel !== wanted) throw new ValidationError({ method: "This channel doesn't match the account chosen." });
    if (!channel && wanted) {
      // No channel named: take the one for this kind of account, preferring one named after its provider (MTN, Orange).
      const matching = channels.filter((c) => c.channel === wanted);
      const provider = account!.provider.toLowerCase();
      channel = matching.find((c) => c.label.toLowerCase().split(/\s+/).some((word) => word.length > 2 && provider.includes(word))) ?? matching[0];
      if (!channel) throw new ValidationError({ paymentMethodId: "Payments of this kind aren't being accepted at the moment." });
    }

    // Today's fee, at today's rates. From here on it is this payment's fee, whatever the rates do.
    const fee = await assessApplicationFee(tx, { id: app.id, institutionId: app.institutionId, webFee: app.institution.webFee });
    if (!fee.priced) throw new ConflictError(fee.reason);
    const feeSnapshot = await takeSnapshot(tx, fee.feeRate, fee.fee.amount);
    const displayCurrency = await savedDisplayCurrency(tx, user.id);
    const displayRate = displayCurrency === fee.currency ? null : await quoteRate(tx, fee.currency, displayCurrency);
    const displaySnapshot = displayRate ? await takeSnapshot(tx, displayRate, fee.amount) : null;

    const id = newId("fee");
    await tx.insert(feePayments).values({
      id,
      applicationInstitutionId: app.id,
      method: channel!.id,
      paymentMethodId: account?.id ?? null,
      paymentAccount: account ? { type: account.type, label: account.label, provider: account.provider, branch: account.branch, accountName: account.accountName, accountNumber: account.accountNumber, swift: account.swift, bankCode: account.bankCode, branchCode: account.branchCode, rib: account.rib } : null,
      reference: v.reference,
      paidFrom: v.paidFrom ?? "",
      receiptFileId: v.receiptFileId ?? null,
      applicationFee: fee.applicationFee,
      webFee: fee.webFee,
      amount: fee.amount,
      currency: fee.currency,
      feeRateSnapshotId: feeSnapshot?.id ?? null,
      displayRateSnapshotId: displaySnapshot?.id ?? null,
      paidAt: new Date(v.paidAt),
    });
    await audit(tx, {
      action: "create",
      entityType: "fee-payment",
      entityId: id,
      institutionId: app.institutionId,
      meta: {
        reference: v.reference,
        amount: fee.amount,
        currency: fee.currency,
        ...(feeSnapshot ? { fee: { currency: feeSnapshot.fromCurrency, amount: feeSnapshot.fromAmount, rate: feeSnapshot.rate } } : {}),
        ...(displaySnapshot ? { shownAs: { currency: displaySnapshot.toCurrency, amount: displaySnapshot.toAmount, rate: displaySnapshot.rate } } : {}),
      },
    });
    await syncCompletion(tx, app.id);
    await notify(tx, { audience: "admin", category: "PAYMENT", title: `Payment to approve: ${app.reference}`, summary: `${v.reference}, ${fee.amount} ${fee.currency}.`, reference: app.reference, action: { label: "Review payments", href: "/admin/payments" } });
  });
  return getMyApplication(user, applicationInstitutionId);
}

const submitSchema = z.object({
  declaration: z.literal(true, "Confirm the declaration to submit."),
  /** The wording the applicant was shown. Optional; when sent, it must be the current one. */
  declarationVersion: z.string().trim().max(40).optional(),
});

/**
 * Submits the application to its institution, or resubmits a correction
 * the institution asked for.
 *
 * Everything on the checklist is checked again here, from what is stored,
 * at the moment of submission: demographic information, education,
 * examinations and their results, the institution and intake, study
 * choices, required uploads, the fee and its approved payment. The
 * applicant must confirm the declaration, which is recorded with the
 * wording they confirmed.
 *
 * The first submission issues the Application ID. An application already
 * submitted can't be submitted again: a second request (a double click,
 * two tabs) is refused, and if two arrive at the same moment only one
 * gets through, because the status only moves from the status it was read
 * in.
 */
export async function submitApplication(user: PublicUser, applicationInstitutionId: string, input: unknown) {
  const v = parseWith(submitSchema, input);
  if (v.declarationVersion && v.declarationVersion !== DECLARATION_VERSION) {
    throw new ValidationError({ declaration: "The declaration has been updated since this page was opened. Reload the page and read it again." });
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadOwn(tx, user, applicationInstitutionId);
    const state = await submissionState(tx, app);
    if (!state.mode) throw new ConflictError(state.reason ?? "This application can't be submitted.");

    const check = await readiness(tx, app, { resubmission: state.mode === "resubmit" });
    if (!check.ready) {
      throw new ValidationError(Object.fromEntries(check.checks.filter((c) => !c.ok).map((c) => [c.key, c.detail])), "This application isn't ready to submit.");
    }

    const now = new Date();
    let applicationNumber = app.applicationNumber;
    if (!applicationNumber) {
      // The Application ID: issued once, never reused, the same through any resubmission.
      const year = now.getUTCFullYear();
      applicationNumber = `AOSA-${year}-${String(await nextCounter(tx, `application-number:${year}`)).padStart(6, "0")}`;
    }
    await tx
      .update(applicationInstitutions)
      .set({ applicationNumber, declarationAcceptedAt: now, declarationVersion: DECLARATION_VERSION })
      .where(eq(applicationInstitutions.id, app.id));

    // A checklist that has only just been completed is recorded as COMPLETED first, so the history shows every step.
    if (app.status === "INCOMPLETE") await transition(tx, app, "COMPLETED", "system");
    await transition(tx, app, state.mode === "resubmit" ? "RESUBMITTED" : "SUBMITTED", "applicant", {
      actorUserId: user.id,
      note: state.mode === "resubmit" ? `Resubmitted as ${applicationNumber}.` : `Submitted as ${applicationNumber}.`,
    });
    await audit(tx, { action: "submit", entityType: "application", entityId: app.id, institutionId: app.institutionId, meta: { applicationNumber, declarationVersion: DECLARATION_VERSION, mode: state.mode } });
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
    await recordOfferResponse(tx, app.id, decision === "accept");
  });
  return getMyApplication(user, applicationInstitutionId);
}
