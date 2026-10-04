import "server-only";
import { randomInt } from "node:crypto";
import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ALL_STATUSES } from "@/lib/admin/status";
import type { PublicUser } from "@/lib/auth/users";
import { makeBankCode } from "@/lib/payments/privacy";
import type { ApplicationStatus } from "@/lib/types";
import { getDb } from "@/server/db/client";
import { applicationInstitutions, applications, auditLog, feePayments, institutions, users } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { ConflictError, NotFoundError } from "@/server/http/errors";
import { pagination, parseQuery, parseWith } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";
import { getFile, signedDownloadUrl } from "@/server/storage/files.service";
import { loadApplicationInstitution } from "./applications.queries";

/**
 * AOSA administration's view of applications: every institution, nothing
 * masked, plus the application fee approval desk and the audit trail.
 */

const like = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;

export async function listAllApplications(req: NextRequest) {
  const query = parseQuery(
    req,
    pagination.extend({
      status: z.enum(ALL_STATUSES as [ApplicationStatus, ...ApplicationStatus[]]).optional(),
      institutionId: z.string().max(100).optional(),
      q: z.string().trim().max(100).optional(),
    })
  );
  const conditions: (SQL | undefined)[] = [];
  if (query.status) conditions.push(eq(applicationInstitutions.status, query.status));
  if (query.institutionId) conditions.push(eq(applicationInstitutions.institutionId, query.institutionId));
  if (query.q) conditions.push(or(ilike(applicationInstitutions.reference, like(query.q)), ilike(users.fullName, like(query.q)), ilike(users.email, like(query.q))));
  const where = and(...conditions);
  const db = getDb();
  const from = () =>
    db
      .select({
        id: applicationInstitutions.id,
        reference: applicationInstitutions.reference,
        status: applicationInstitutions.status,
        submittedAt: applicationInstitutions.submittedAt,
        updatedAt: applicationInstitutions.updatedAt,
        institutionId: institutions.id,
        institutionName: institutions.name,
        applicantId: users.id,
        applicantName: users.fullName,
        applicantEmail: users.email,
      })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId));
  const [rows, [{ total }]] = await Promise.all([
    from()
      .where(where)
      .orderBy(desc(applicationInstitutions.updatedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .where(where),
  ]);
  return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getApplicationForAdmin(user: PublicUser, id: string) {
  const db = getDb();
  const app = await loadApplicationInstitution(db, id);
  const [applicant] = await db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone }).from(users).where(eq(users.id, app.application.applicantId)).limit(1);
  const documents = await Promise.all(
    app.documents.map(async (d) => {
      const file = await getFile(db, d.fileId).catch(() => null);
      return { ...d, file: file ? { name: file.originalName, size: file.sizeBytes, url: await signedDownloadUrl(user, file) } : null };
    })
  );
  return { ...app, documents, applicant };
}

// ---------------------------------------------------------------------------
// Application fee approval desk
// ---------------------------------------------------------------------------

export async function listFeePayments(req: NextRequest) {
  const query = parseQuery(
    req,
    pagination.extend({
      approval: z.enum(["AWAITING", "APPROVED", "REJECTED"]).optional(),
      institutionId: z.string().max(100).optional(),
      q: z.string().trim().max(100).optional(),
    })
  );
  const conditions: (SQL | undefined)[] = [];
  if (query.approval) conditions.push(eq(feePayments.approval, query.approval));
  if (query.institutionId) conditions.push(eq(applicationInstitutions.institutionId, query.institutionId));
  if (query.q) conditions.push(or(ilike(feePayments.reference, like(query.q)), ilike(feePayments.bankCode, like(query.q)), ilike(applicationInstitutions.reference, like(query.q)), ilike(users.fullName, like(query.q))));
  const where = and(...conditions);
  const db = getDb();
  const base = db
    .select({
      payment: feePayments,
      applicationReference: applicationInstitutions.reference,
      institutionId: applicationInstitutions.institutionId,
      institutionName: institutions.name,
      applicantName: users.fullName,
      applicantEmail: users.email,
    })
    .from(feePayments)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, feePayments.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId));
  const [rows, [{ total }]] = await Promise.all([
    base
      .where(where)
      .orderBy(desc(feePayments.submittedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(feePayments)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, feePayments.applicationInstitutionId))
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .where(where),
  ]);
  return { data: rows.map((r) => ({ ...r.payment, applicationReference: r.applicationReference, institutionId: r.institutionId, institutionName: r.institutionName, applicantName: r.applicantName, applicantEmail: r.applicantEmail })), meta: { page: query.page, pageSize: query.pageSize, total } };
}

const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(500).optional() }),
  z.object({ decision: z.literal("reject"), note: z.string().trim().min(1, "Say why the payment is rejected.").max(500) }),
]);

/** Approve (issuing a bank code) or reject a recorded application fee payment. */
export async function reviewFeePayment(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(reviewSchema, input);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(feePayments).where(eq(feePayments.id, id)).limit(1);
    if (!payment) throw new NotFoundError("Payment");
    if (payment.approval !== "AWAITING") throw new ConflictError("This payment has already been reviewed.");
    const app = await loadApplicationInstitution(tx, payment.applicationInstitutionId);

    let bankCode: string | null = null;
    if (v.decision === "approve") {
      // Cryptographically random, in the format institutions already look codes up by.
      const next = () => randomInt(0, 2 ** 32) / 2 ** 32;
      for (let attempt = 0; attempt < 5 && !bankCode; attempt++) {
        const candidate = makeBankCode("A", new Date().getUTCFullYear(), next);
        const [clash] = await tx.select({ id: feePayments.id }).from(feePayments).where(eq(feePayments.bankCode, candidate)).limit(1);
        if (!clash) bankCode = candidate;
      }
      if (!bankCode) throw new ConflictError("Couldn't issue a unique bank code. Try again.");
    }

    const [updated] = await tx
      .update(feePayments)
      .set({ approval: v.decision === "approve" ? "APPROVED" : "REJECTED", bankCode, reviewedAt: new Date(), reviewedBy: user.id, note: v.note ?? "" })
      .where(eq(feePayments.id, id))
      .returning();
    await audit(tx, { action: v.decision === "approve" ? "approve" : "reject", entityType: "fee-payment", entityId: id, institutionId: app.institutionId, before: { approval: payment.approval }, after: { approval: updated.approval, bankCode } });

    await notify(tx, {
      audience: "student",
      recipientUserId: app.application.applicantId,
      category: "PAYMENT",
      title: v.decision === "approve" ? "Application fee approved" : "Application fee payment rejected",
      summary: v.decision === "approve" ? `Your payment for ${app.institution.name} is approved. Bank code ${bankCode}.` : `Your payment for ${app.institution.name} was rejected: ${v.note}`,
      important: v.decision === "reject",
      reference: app.reference,
      action: { label: v.decision === "approve" ? "Submit your application" : "Record the payment again", href: v.decision === "approve" ? "/student/submit/print-submit" : "/student/fees/payment-options" },
    });
    if (v.decision === "approve") {
      // The institution learns of it by bank code only — no amount beyond its own fee, never the web fee.
      await notify(tx, {
        audience: "institution",
        institutionId: app.institutionId,
        category: "PAYMENT",
        title: `Application fee confirmed: ${bankCode}`,
        summary: `${app.reference}: application fee of ${payment.applicationFee} XAF confirmed by AOSA.`,
        reference: app.reference,
        action: { label: "Open application", href: `/institution/applications/${app.id}` },
      });
    }
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export async function listAudit(req: NextRequest) {
  const query = parseQuery(
    req,
    pagination.extend({
      entityType: z.string().max(60).optional(),
      entityId: z.string().max(100).optional(),
      actorUserId: z.string().max(100).optional(),
      institutionId: z.string().max(100).optional(),
      action: z.string().max(60).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
  );
  const conditions: (SQL | undefined)[] = [
    query.entityType ? eq(auditLog.entityType, query.entityType) : undefined,
    query.entityId ? eq(auditLog.entityId, query.entityId) : undefined,
    query.actorUserId ? eq(auditLog.actorUserId, query.actorUserId) : undefined,
    query.institutionId ? eq(auditLog.institutionId, query.institutionId) : undefined,
    query.action ? eq(auditLog.action, query.action) : undefined,
    query.from ? gte(auditLog.at, new Date(`${query.from}T00:00:00Z`)) : undefined,
    query.to ? lte(auditLog.at, new Date(`${query.to}T23:59:59.999Z`)) : undefined,
  ];
  const where = and(...conditions);
  const db = getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.at))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(auditLog).where(where),
  ]);
  return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
}
