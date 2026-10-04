import "server-only";
import { and, count, desc, eq, ilike, isNotNull, or, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import { ALL_STATUSES } from "@/lib/admin/status";
import type { PublicUser } from "@/lib/auth/users";
import { maskFullName } from "@/lib/payments/privacy";
import type { ApplicationStatus } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import { admissions, applicationDocuments, applicationInstitutions, applications, demographicProfiles, educationRecords, feePayments, institutionStaff, parameters, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { pagination, parseQuery, parseWith } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";
import { getFile, signedDownloadUrl } from "@/server/storage/files.service";
import { loadApplicationInstitution, type LoadedApplication } from "./applications.queries";
import { transition } from "./applications.workflow";

/**
 * The institution's side of applications, scoped to the caller's
 * institution. Applies the payment privacy rules (src/lib/payments/privacy.ts)
 * server-side, where they can't be bypassed:
 *
 * - the platform web fee is never included;
 * - until AOSA approves the fee, the applicant shows only as
 *   "<first name> <initial>." with no contact details, documents or program;
 * - after approval the payment is identified by its bank code.
 */

type StaffPermission = "PAYMENTS_UPLOADS" | "ACKNOWLEDGED_APPS" | "REJECTED_APPS" | "DELIBERATION";

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

/** Institution admins can do everything; admission users need the permission on their staff record. */
async function assertPermission(db: Executor, user: PublicUser, permission: StaffPermission) {
  if (user.role === "INSTITUTION_ADMIN") return;
  const [staff] = await db.select({ permissions: institutionStaff.permissions }).from(institutionStaff).where(eq(institutionStaff.userId, user.id)).limit(1);
  if (!staff?.permissions.includes(permission)) throw new ForbiddenError("Your staff account doesn't have permission for this.");
}

const listQuery = pagination.extend({
  status: z.enum(ALL_STATUSES as [ApplicationStatus, ...ApplicationStatus[]]).optional(),
  q: z.string().trim().max(100).optional(),
});

export async function listForInstitution(user: PublicUser, req: NextRequest) {
  const institutionId = institutionOf(user);
  const query = parseQuery(req, listQuery);
  const db = getDb();

  // At most one approved payment per application (enforced when payments are recorded and approved).
  const approved = db.$with("approved").as(
    db.select({ applicationInstitutionId: feePayments.applicationInstitutionId, bankCode: feePayments.bankCode, applicationFee: feePayments.applicationFee }).from(feePayments).where(eq(feePayments.approval, "APPROVED"))
  );

  const conditions: (SQL | undefined)[] = [eq(applicationInstitutions.institutionId, institutionId)];
  if (query.status) conditions.push(eq(applicationInstitutions.status, query.status));
  if (query.q) {
    const like = `%${query.q.replace(/[%_\\]/g, "\\$&")}%`;
    // Names only match once the fee is approved, so a search can't reveal a masked applicant.
    conditions.push(or(ilike(applicationInstitutions.reference, like), ilike(approved.bankCode, like), and(isNotNull(approved.bankCode), ilike(users.fullName, like))));
  }
  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .with(approved)
      .select({
        id: applicationInstitutions.id,
        reference: applicationInstitutions.reference,
        status: applicationInstitutions.status,
        submittedAt: applicationInstitutions.submittedAt,
        updatedAt: applicationInstitutions.updatedAt,
        fullName: users.fullName,
        bankCode: approved.bankCode,
        applicationFee: approved.applicationFee,
      })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .leftJoin(approved, eq(approved.applicationInstitutionId, applicationInstitutions.id))
      .where(where)
      .orderBy(desc(applicationInstitutions.updatedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .with(approved)
      .select({ total: count() })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .leftJoin(approved, eq(approved.applicationInstitutionId, applicationInstitutions.id))
      .where(where),
  ]);

  const data = rows.map((r) => {
    const paid = !!r.bankCode;
    return {
      id: r.id,
      reference: r.reference,
      status: r.status,
      submittedAt: r.submittedAt,
      updatedAt: r.updatedAt,
      applicant: paid ? r.fullName : `${maskFullName(r.fullName)} — awaiting payment`,
      masked: !paid,
      bankCode: r.bankCode,
      applicationFee: paid ? r.applicationFee : null,
    };
  });
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}

async function loadForInstitution(db: Executor, user: PublicUser, id: string) {
  const app = await loadApplicationInstitution(db, id);
  if (app.institutionId !== institutionOf(user)) throw new NotFoundError("Application");
  return app;
}

export async function getForInstitution(user: PublicUser, id: string) {
  const db = getDb();
  const app = await loadForInstitution(db, user, id);
  const approved = app.payments.find((p) => p.approval === "APPROVED");
  const submitted = !EDITABLE_STATUSES.includes(app.status as ApplicationStatus);
  const [applicant] = await db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone }).from(users).where(eq(users.id, app.application.applicantId)).limit(1);

  const base = {
    id: app.id,
    reference: app.reference,
    status: app.status,
    submittedAt: app.submittedAt,
    history: app.events.map((e) => ({ status: e.status, actor: e.actor, note: e.note, at: e.at })),
  };
  if (!approved) {
    return { ...base, masked: true, applicant: { displayName: `${maskFullName(applicant.fullName)} — awaiting payment` } };
  }

  const [demographic, education, documents] = await Promise.all([
    submitted ? db.select().from(demographicProfiles).where(eq(demographicProfiles.userId, applicant.id)).limit(1) : Promise.resolve([]),
    submitted ? db.select().from(educationRecords).where(eq(educationRecords.userId, applicant.id)) : Promise.resolve([]),
    submitted
      ? Promise.all(
          app.documents.map(async (d) => {
            const file = await getFile(db, d.fileId).catch(() => null);
            return { id: d.id, requirementName: d.requirementName, reviewStatus: d.reviewStatus, rejectionReason: d.rejectionReason, file: file ? { name: file.originalName, size: file.sizeBytes, url: await signedDownloadUrl(user, file) } : null };
          })
        )
      : Promise.resolve([]),
  ]);

  return {
    ...base,
    masked: false,
    applicant: { displayName: applicant.fullName, email: applicant.email, phone: applicant.phone },
    // Never the web fee.
    payment: { bankCode: approved.bankCode, applicationFee: approved.applicationFee, approvedAt: approved.reviewedAt },
    choices: app.choices,
    documents,
    demographic: demographic[0] ?? null,
    education,
  };
}

const decisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge"), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("reject"), reasonId: z.string().trim().min(1, "Choose a rejection reason."), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("accept"), programId: z.string().trim().min(1, "Choose the program being offered."), note: z.string().trim().max(1000).optional() }),
]);

/** Acknowledge, reject or accept an application. Used by institution staff and, with actor "admin", by AOSA. */
export async function decide(user: PublicUser, id: string, input: unknown, actor: "institution" | "admin" = "institution") {
  const v = parseWith(decisionSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app: LoadedApplication = actor === "admin" ? await loadApplicationInstitution(tx, id) : await loadForInstitution(tx, user, id);
    if (actor === "institution") await assertPermission(tx, user, v.action === "reject" ? "REJECTED_APPS" : v.action === "accept" ? "DELIBERATION" : "ACKNOWLEDGED_APPS");
    if (!app.payments.some((p) => p.approval === "APPROVED")) throw new ValidationError({ status: "The application fee hasn't been approved yet." });

    if (v.action === "acknowledge") {
      await transition(tx, app, "I_ACKNOWLEDGED", actor, { actorUserId: user.id, note: v.note });
    } else if (v.action === "reject") {
      const [reason] = await tx
        .select()
        .from(parameters)
        .where(and(eq(parameters.id, v.reasonId), eq(parameters.category, "rejection-reasons"), eq(parameters.status, "ACTIVE")))
        .limit(1);
      if (!reason) throw new ValidationError({ reasonId: "Choose a rejection reason from the list." });
      await transition(tx, app, "I_REJECTED", actor, { actorUserId: user.id, reasonId: reason.id, note: v.note ? `${reason.label}. ${v.note}` : reason.label });
    } else {
      const choice = app.choices.find((c) => c.programId === v.programId);
      if (!choice) throw new ValidationError({ programId: "Offer one of the programs the applicant chose." });
      await transition(tx, app, "ACCEPTED", actor, { actorUserId: user.id, note: v.note ?? `Offered ${choice.programName}.` });
      await tx
        .insert(admissions)
        .values({ id: newId("adm"), applicationInstitutionId: app.id, programId: choice.programId, choice: choice.rank, status: "OFFERED", offeredAt: new Date() })
        .onConflictDoUpdate({ target: admissions.applicationInstitutionId, set: { programId: choice.programId, choice: choice.rank, status: "OFFERED", offeredAt: new Date() } });
    }
  });
  return actor === "admin" ? null : getForInstitution(user, id);
}

const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({ decision: z.literal("reject"), reason: z.string().trim().min(1, "Say why the document is rejected.").max(500) }),
]);

export async function reviewDocument(user: PublicUser, id: string, documentId: string, input: unknown) {
  const v = parseWith(reviewSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadForInstitution(tx, user, id);
    await assertPermission(tx, user, "PAYMENTS_UPLOADS");
    if (EDITABLE_STATUSES.includes(app.status as ApplicationStatus)) throw new ValidationError({ status: "Documents are reviewed once the application is submitted." });
    const doc = app.documents.find((d) => d.id === documentId);
    if (!doc) throw new NotFoundError("Document");
    await tx
      .update(applicationDocuments)
      .set({ reviewStatus: v.decision === "approve" ? "APPROVED" : "REJECTED", rejectionReason: v.decision === "reject" ? v.reason : null, reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(applicationDocuments.id, doc.id));
    await audit(tx, { action: "review", entityType: "application-document", entityId: doc.id, institutionId: app.institutionId, before: { reviewStatus: doc.reviewStatus }, after: { reviewStatus: v.decision === "approve" ? "APPROVED" : "REJECTED" } });
    if (v.decision === "reject") {
      await notify(tx, {
        audience: "student",
        recipientUserId: app.application.applicantId,
        category: "UPLOAD",
        title: `${app.institution.name}: document rejected`,
        summary: `${doc.requirementName}: ${v.reason}`,
        important: true,
        reference: app.reference,
        action: { label: "Upload again", href: "/student/institutions/upload" },
      });
    }
  });
  return getForInstitution(user, id);
}

/** Counts by status for the institution dashboard. */
export async function statusCounts(user: PublicUser) {
  const rows = await getDb()
    .select({ status: applicationInstitutions.status, n: count() })
    .from(applicationInstitutions)
    .where(eq(applicationInstitutions.institutionId, institutionOf(user)))
    .groupBy(applicationInstitutions.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

