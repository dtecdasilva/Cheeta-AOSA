import "server-only";
import { randomInt } from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { ALL_STATUSES } from "@/lib/admin/status";
import { EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import type { PublicUser } from "@/lib/auth/users";
import { makeBankCode } from "@/lib/payments/privacy";
import type { ApplicationStatus } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import { applicationInstitutions, applications, auditLog, feePayments, files, institutions, parameters, programChoices, programs, users } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { pagination, parseQuery, parseWith } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";
import { notifyEvent } from "@/server/notifications/engine";
import { fileUrl, getFile } from "@/server/storage/files.service";
import { loadApplicationInstitution, type LoadedApplication } from "./applications.queries";
import { syncCompletion } from "./applications.workflow";
import { loadSnapshots, presentSnapshot } from "@/server/modules/reference/conversion.service";

/**
 * AOSA administration's view of applications: every institution, nothing
 * masked, plus the verification of payment records and the audit trail.
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
      return { ...d, file: file ? { name: file.originalName, size: file.sizeBytes, url: fileUrl(file) } : null };
    })
  );
  return { ...app, documents, applicant };
}

// ---------------------------------------------------------------------------
// Payment records and their verification
// ---------------------------------------------------------------------------

const APPROVALS = ["AWAITING", "APPROVED", "REJECTED"] as const;

/**
 * Every payment applicants have recorded, for Cheeta administration to
 * verify: ?approval=AWAITING|APPROVED|REJECTED, ?institutionId=,
 * ?method=, ?from= and ?to= (the dates it was recorded between), ?q=.
 *
 * Each record comes with what is needed to check it against the bank or
 * operator statement: the account it was paid into as it read that day,
 * the reference, the date, who it was sent from, the evidence uploaded,
 * and whether the same reference appears on another application.
 */
export async function listFeePayments(req: NextRequest) {
  const query = parseQuery(
    req,
    pagination.extend({
      approval: z.enum(APPROVALS).optional(),
      institutionId: z.string().max(100).optional(),
      method: z.string().max(100).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      q: z.string().trim().max(100).optional(),
    })
  );
  const conditions: (SQL | undefined)[] = [];
  if (query.approval) conditions.push(eq(feePayments.approval, query.approval));
  if (query.institutionId) conditions.push(eq(applicationInstitutions.institutionId, query.institutionId));
  if (query.method) conditions.push(eq(feePayments.method, query.method));
  if (query.from) conditions.push(gte(feePayments.submittedAt, new Date(`${query.from}T00:00:00Z`)));
  if (query.to) conditions.push(lte(feePayments.submittedAt, new Date(`${query.to}T23:59:59.999Z`)));
  if (query.q)
    conditions.push(
      or(ilike(feePayments.reference, like(query.q)), ilike(feePayments.bankCode, like(query.q)), ilike(applicationInstitutions.reference, like(query.q)), ilike(users.fullName, like(query.q)), ilike(users.email, like(query.q)), ilike(institutions.name, like(query.q)))
    );
  const where = and(...conditions);
  const db = getDb();
  const verifier = alias(users, "verifier");
  const base = db
    .select({
      payment: feePayments,
      applicationReference: applicationInstitutions.reference,
      applicationStatus: applicationInstitutions.status,
      institutionId: applicationInstitutions.institutionId,
      institutionName: institutions.name,
      applicantName: users.fullName,
      applicantEmail: users.email,
      methodLabel: parameters.label,
      verifierName: verifier.fullName,
    })
    .from(feePayments)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, feePayments.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .leftJoin(parameters, eq(parameters.id, feePayments.method))
    .leftJoin(verifier, eq(verifier.id, feePayments.reviewedBy));
  const [rows, [{ total }]] = await Promise.all([
    base
      .where(where)
      // The queue is worked oldest first; everything already decided reads newest first.
      .orderBy(query.approval === "AWAITING" ? asc(feePayments.submittedAt) : desc(feePayments.submittedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(feePayments)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, feePayments.applicationInstitutionId))
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
      .where(where),
  ]);

  const appIds = [...new Set(rows.map((r) => r.payment.applicationInstitutionId))];
  const references = [...new Set(rows.map((r) => r.payment.reference.trim().toLowerCase()))];
  const receiptIds = rows.map((r) => r.payment.receiptFileId).filter((id): id is string => !!id);
  const [snapshots, firstChoices, sameReference, receipts, live] = await Promise.all([
    // The conversions stored with each payment when it was recorded. They are read back as stored, never worked out again.
    loadSnapshots(db, rows.flatMap((r) => [r.payment.feeRateSnapshotId, r.payment.displayRateSnapshotId])),
    appIds.length
      ? db
          .select({ applicationInstitutionId: programChoices.applicationInstitutionId, name: programs.name })
          .from(programChoices)
          .innerJoin(programs, eq(programs.id, programChoices.programId))
          .where(and(inArray(programChoices.applicationInstitutionId, appIds), eq(programChoices.rank, 1)))
      : [],
    // The same transaction reference on a different application is the commonest sign of one receipt being used twice.
    references.length
      ? db
          .select({ reference: sql<string>`lower(trim(${feePayments.reference}))`, applicationInstitutionId: feePayments.applicationInstitutionId })
          .from(feePayments)
          .where(and(inArray(sql`lower(trim(${feePayments.reference}))`, references), ne(feePayments.approval, "REJECTED")))
      : [],
    receiptIds.length ? db.select().from(files).where(and(inArray(files.id, receiptIds), isNull(files.deletedAt))) : [],
    appIds.length
      ? db
          .select({ id: feePayments.id, applicationInstitutionId: feePayments.applicationInstitutionId })
          .from(feePayments)
          .where(and(inArray(feePayments.applicationInstitutionId, appIds), ne(feePayments.approval, "REJECTED")))
      : [],
  ]);
  const stored = (id: string | null) => (id && snapshots.has(id) ? presentSnapshot(snapshots.get(id)!) : null);
  const programOf = new Map(firstChoices.map((c) => [c.applicationInstitutionId, c.name]));
  const receiptOf = new Map(receipts.map((f) => [f.id, f]));

  return {
    data: rows.map((r) => {
      const p = r.payment;
      const receipt = p.receiptFileId ? receiptOf.get(p.receiptFileId) : undefined;
      const others = live.filter((l) => l.applicationInstitutionId === p.applicationInstitutionId && l.id !== p.id).length;
      return {
        id: p.id,
        applicationInstitutionId: p.applicationInstitutionId,
        applicationReference: r.applicationReference,
        institutionId: r.institutionId,
        institutionName: r.institutionName,
        applicantName: r.applicantName,
        applicantEmail: r.applicantEmail,
        programName: programOf.get(p.applicationInstitutionId) ?? null,
        // Payment method: the channel, and the institution account paid into as it read when the payment was recorded.
        method: p.method,
        methodLabel: r.methodLabel ?? p.method,
        paymentMethodId: p.paymentMethodId,
        paymentAccount: p.paymentAccount,
        paidFrom: p.paidFrom,
        reference: p.reference,
        sameReferenceElsewhere: sameReference.filter((x) => x.reference === p.reference.trim().toLowerCase() && x.applicationInstitutionId !== p.applicationInstitutionId).length,
        currency: p.currency,
        amount: p.amount,
        applicationFee: p.applicationFee,
        webFee: p.webFee,
        feeConversion: stored(p.feeRateSnapshotId),
        displayConversion: stored(p.displayRateSnapshotId),
        paidAt: p.paidAt,
        submittedAt: p.submittedAt,
        evidence: receipt ? { id: receipt.id, name: receipt.originalName, size: receipt.sizeBytes, mimeType: receipt.mimeType, url: fileUrl(receipt) } : null,
        // Verification: where it stands, who decided and when, and why if it was rejected.
        approval: p.approval,
        verifiedBy: p.reviewedBy ? { id: p.reviewedBy, name: r.verifierName ?? "" } : null,
        verifiedAt: p.reviewedAt,
        rejectionReason: p.rejectionReason,
        rejectionReasonId: p.rejectionReasonId,
        note: p.note,
        bankCode: p.bankCode,
        // A decision can be taken back only while nothing has been built on it (see reopenFeePayment).
        canReopen: p.approval !== "AWAITING" && others === 0 && (p.approval === "REJECTED" || EDITABLE_STATUSES.includes(r.applicationStatus as ApplicationStatus)),
      };
    }),
    meta: { page: query.page, pageSize: query.pageSize, total },
  };
}

export type FeePaymentRecord = Awaited<ReturnType<typeof listFeePayments>>["data"][number];

/** Totals across every payment record, and what the desk's filters can choose from. */
export async function feePaymentSummary() {
  const db = getDb();
  const [totals, institutionRows, methodRows] = await Promise.all([
    db
      .select({
        approval: feePayments.approval,
        n: count(),
        amount: sql<number>`coalesce(sum(${feePayments.amount}), 0)::float8`,
        applicationFee: sql<number>`coalesce(sum(${feePayments.applicationFee}), 0)::float8`,
        webFee: sql<number>`coalesce(sum(${feePayments.webFee}), 0)::float8`,
      })
      .from(feePayments)
      .groupBy(feePayments.approval),
    db
      .selectDistinct({ id: institutions.id, name: institutions.name })
      .from(feePayments)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, feePayments.applicationInstitutionId))
      .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
      .orderBy(asc(institutions.name)),
    db.selectDistinct({ id: feePayments.method, label: parameters.label }).from(feePayments).leftJoin(parameters, eq(parameters.id, feePayments.method)),
  ]);
  const of = (approval: (typeof APPROVALS)[number]) => {
    const row = totals.find((t) => t.approval === approval);
    return { count: row?.n ?? 0, amount: row?.amount ?? 0, applicationFee: row?.applicationFee ?? 0, webFee: row?.webFee ?? 0 };
  };
  return {
    currency: BASE_CURRENCY,
    awaiting: of("AWAITING"),
    approved: of("APPROVED"),
    rejected: of("REJECTED"),
    institutions: institutionRows,
    methods: methodRows.map((m) => ({ id: m.id, label: m.label ?? m.id })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(500).optional() }),
  // A standard reason from the "Rejection reasons" list, anything the verifier adds in their own words, or both.
  z
    .object({ decision: z.literal("reject"), reasonId: z.string().trim().max(200).optional(), reason: z.string().trim().max(500).optional() })
    .refine((v) => v.reasonId || v.reason, { path: ["reason"], message: "Say why the payment is rejected." }),
  z.object({ decision: z.literal("reopen") }),
]);

/**
 * Verifies a recorded payment. This is the only place a payment's
 * verification status changes: nothing marks a payment as paid when it is
 * recorded, when evidence is uploaded or after any amount of time. An
 * administrator decides, and the decision is stamped with who and when.
 *
 * - approve: issues the bank code the institution identifies the payment by.
 * - reject: needs the reason, which the applicant is shown.
 * - reopen: takes a decision back and puts the payment in the queue again.
 */
export async function reviewFeePayment(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(reviewSchema, input);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(feePayments).where(eq(feePayments.id, id)).limit(1);
    if (!payment) throw new NotFoundError("Payment");
    const app = await loadApplicationInstitution(tx, payment.applicationInstitutionId);
    if (v.decision === "reopen") return reopenFeePayment(tx, payment, app);
    if (payment.approval !== "AWAITING") throw new ConflictError("This payment has already been verified.");

    let bankCode: string | null = null;
    if (v.decision === "approve") {
      if (app.payments.some((p) => p.id !== payment.id && p.approval === "APPROVED")) throw new ConflictError("Another payment is already approved for this application.");
      // Cryptographically random, in the format institutions already look codes up by.
      const next = () => randomInt(0, 2 ** 32) / 2 ** 32;
      for (let attempt = 0; attempt < 5 && !bankCode; attempt++) {
        const candidate = makeBankCode("A", new Date().getUTCFullYear(), next);
        const [clash] = await tx.select({ id: feePayments.id }).from(feePayments).where(eq(feePayments.bankCode, candidate)).limit(1);
        if (!clash) bankCode = candidate;
      }
      if (!bankCode) throw new ConflictError("Couldn't issue a unique bank code. Try again.");
    }

    let reason: string | null = null;
    let reasonId: string | null = null;
    if (v.decision === "reject") {
      if (v.reasonId) {
        const [standard] = await tx
          .select()
          .from(parameters)
          .where(and(eq(parameters.id, v.reasonId), eq(parameters.category, "rejection-reasons"), eq(parameters.status, "ACTIVE")))
          .limit(1);
        if (!standard || standard.attrs?.appliesTo !== "payment") throw new ValidationError({ reasonId: "Choose a reason from the list." });
        reasonId = standard.id;
        // The applicant reads one sentence: the standard reason, then whatever was added to it.
        reason = v.reason ? `${standard.label}. ${v.reason}` : standard.label;
      } else reason = v.reason ?? "";
    }
    const [updated] = await tx
      .update(feePayments)
      .set({ approval: v.decision === "approve" ? "APPROVED" : "REJECTED", bankCode, reviewedAt: new Date(), reviewedBy: user.id, rejectionReason: reason, rejectionReasonId: reasonId, note: v.decision === "approve" ? v.note ?? "" : "" })
      // Still awaiting at the moment of writing: two administrators deciding at once can't both succeed.
      .where(and(eq(feePayments.id, id), eq(feePayments.approval, "AWAITING")))
      .returning();
    if (!updated) throw new ConflictError("This payment has already been verified.");
    // An approved payment can complete the application's checklist; a rejected one can't.
    await syncCompletion(tx, app.id);
    await audit(tx, {
      action: v.decision === "approve" ? "approve" : "reject",
      entityType: "fee-payment",
      entityId: id,
      institutionId: app.institutionId,
      before: { approval: payment.approval },
      after: { approval: updated.approval, bankCode, rejectionReason: reason },
    });

    // The method is a parameter id ("payment-method-types:MOMO") or, for older records, its label.
    const [method] = updated.method.includes(":") ? await tx.select({ label: parameters.label }).from(parameters).where(eq(parameters.id, updated.method)).limit(1) : [];
    await notifyEvent(tx, {
      event: v.decision === "approve" ? "payment.received" : "payment.rejected",
      to: { userId: app.application.applicantId },
      applicationId: app.id,
      values: { "payment.amount": `${updated.amount.toLocaleString("en-US")} ${updated.currency}`, "payment.method": method?.label ?? updated.method, "payment.reference": updated.reference, reason },
      inApp: {
        title: v.decision === "approve" ? "Application fee approved" : "Application fee payment rejected",
        summary: v.decision === "approve" ? `Your payment for ${app.institution.name} is approved. Bank code ${bankCode}.` : `Your payment for ${app.institution.name} was rejected: ${reason}`,
      },
      important: v.decision === "reject",
      action: { label: v.decision === "approve" ? "Submit your application" : "Record the payment again", href: v.decision === "approve" ? "/student/submit/print-submit" : "/student/fees/payment-options" },
    });
    if (v.decision === "approve") {
      // The institution learns of it by bank code only — no amount beyond its own fee, never the web fee.
      await notify(tx, {
        audience: "institution",
        institutionId: app.institutionId,
        category: "PAYMENT",
        title: `Application fee confirmed: ${bankCode}`,
        summary: `${app.reference}: application fee of ${payment.applicationFee} ${payment.currency} confirmed by AOSA.`,
        reference: app.reference,
        action: { label: "Open application", href: `/institution/applications/${app.id}` },
      });
    }
    return updated;
  });
}

/**
 * Takes a verification decision back, for one made by mistake. Refused
 * once something depends on the decision: an approved payment whose
 * application has been submitted, or any payment whose application has
 * another payment awaiting or approved (the applicant recorded again after
 * a rejection). The earlier decision stays in the audit trail.
 */
async function reopenFeePayment(tx: Executor, payment: typeof feePayments.$inferSelect, app: LoadedApplication) {
  if (payment.approval === "AWAITING") throw new ConflictError("This payment is already awaiting verification.");
  if (payment.approval === "APPROVED" && !EDITABLE_STATUSES.includes(app.status as ApplicationStatus)) {
    throw new ConflictError("This application has been submitted on the strength of this payment, so the approval can't be taken back.");
  }
  if (app.payments.some((p) => p.id !== payment.id && p.approval !== "REJECTED")) throw new ConflictError("The applicant has recorded another payment for this application since. Verify that one instead.");
  const [updated] = await tx
    .update(feePayments)
    .set({ approval: "AWAITING", bankCode: null, reviewedAt: null, reviewedBy: null, rejectionReason: null, rejectionReasonId: null, note: "" })
    .where(and(eq(feePayments.id, payment.id), eq(feePayments.approval, payment.approval)))
    .returning();
  if (!updated) throw new ConflictError("This payment has just been changed by someone else. Reload and try again.");
  await syncCompletion(tx, app.id);
  await audit(tx, {
    action: "reopen",
    entityType: "fee-payment",
    entityId: payment.id,
    institutionId: app.institutionId,
    before: { approval: payment.approval, bankCode: payment.bankCode, rejectionReason: payment.rejectionReason, reviewedBy: payment.reviewedBy },
    after: { approval: "AWAITING", bankCode: null, rejectionReason: null, reviewedBy: null },
  });
  await notify(tx, {
    audience: "student",
    recipientUserId: app.application.applicantId,
    category: "PAYMENT",
    title: "Your payment is being checked again",
    summary: payment.approval === "APPROVED" ? `The approval of your payment for ${app.institution.name} has been withdrawn while it is checked again.` : `Your payment for ${app.institution.name} is being looked at again. You don't need to record it a second time.`,
    important: payment.approval === "APPROVED",
    reference: app.reference,
    action: { label: "View fees", href: "/student/fees/summary" },
  });
  if (payment.approval === "APPROVED") {
    await notify(tx, {
      audience: "institution",
      institutionId: app.institutionId,
      category: "PAYMENT",
      title: `Bank code withdrawn: ${payment.bankCode}`,
      summary: `${app.reference}: AOSA is checking this payment again. The bank code no longer identifies a paid applicant.`,
      reference: app.reference,
    });
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

