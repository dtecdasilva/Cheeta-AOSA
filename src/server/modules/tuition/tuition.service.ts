import "server-only";
import { feeCategoryOf } from "@/server/modules/fees/calculation";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { PublicUser } from "@/lib/auth/users";
import { makeBankCode } from "@/lib/payments/privacy";
import { figures, institutionTuitionView, type Instalment, type TuitionAccount, type TuitionPayment, type VerificationStatus } from "@/lib/tuition/data";
import { getDb, type Executor } from "@/server/db/client";
import {
  admissions,
  applicantProfiles,
  applicationInstitutions,
  applications,
  demographicProfiles,
  feeConfigs,
  files,
  institutionPaymentMethods,
  institutions,
  parameters,
  programs,
  tuitionAccounts,
  tuitionPaymentReviews,
  tuitionPayments,
  tuitionRequirements,
  users,
} from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { assertPermission } from "@/server/auth/access";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { pagination, parseQuery, parseWith, text } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";
import { notifyEvent } from "@/server/notifications/engine";
import { syncMedicalRecords } from "@/server/modules/medical/medical.service";

/**
 * Tuition for admitted students.
 *
 * No money moves on the platform. The institution sets what it charges
 * (tuition requirements). When an applicant takes up an offer, a tuition
 * account is opened with the amount and instalments then in force. The
 * student pays outside the platform and records each payment here.
 * Cheeta administration checks each one and verifies, queries or rejects
 * it; verifying issues the bank code the institution knows the payment by.
 * The institution marks verified payments received on its own statement.
 *
 * Only VERIFIED payments count: what is paid, what is outstanding and the
 * tuition status are all worked out from verified money, so a payment the
 * student has merely recorded never makes tuition "paid".
 *
 * Until a payment is verified, the institution sees the student only as a
 * masked name "awaiting payment" (lib/tuition/data.ts, institutionTuitionView).
 */

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

const isoDate = z.iso.date({ error: "Enter a date." });
const instalmentSchema = z.object({ label: z.string().trim().min(1, "Name the instalment.").max(100), dueDate: isoDate, amount: z.number().int().positive("Enter an amount.") });

const requirementSchema = z.object({
  programId: z.string().max(100).nullable().default(null),
  academicYearId: z.string().max(200).nullable().default(null),
  category: z.enum(["national", "international"]),
  currency: z.string().trim().toUpperCase().length(3).default("XAF"),
  amount: z.number().int().positive("Enter the tuition amount.").max(100_000_000),
  instalments: z.array(instalmentSchema).max(12).default([]),
  notes: text(1000).default(""),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

async function checkRequirement(db: Executor, institutionId: string, v: z.infer<typeof requirementSchema>, exceptId?: string) {
  if (v.programId) {
    const [p] = await db.select({ id: programs.id }).from(programs).where(and(eq(programs.id, v.programId), eq(programs.institutionId, institutionId))).limit(1);
    if (!p) throw new ValidationError({ programId: "Choose one of your programs." });
  }
  if (v.academicYearId) {
    const [y] = await db.select({ id: parameters.id }).from(parameters).where(and(eq(parameters.id, v.academicYearId), eq(parameters.category, "academic-years"))).limit(1);
    if (!y) throw new ValidationError({ academicYearId: "Choose an academic year." });
  }
  if (v.instalments.length) {
    const total = v.instalments.reduce((s, i) => s + i.amount, 0);
    if (total !== v.amount) throw new ValidationError({ instalments: `The instalments add up to ${total.toLocaleString("en-US")}, not ${v.amount.toLocaleString("en-US")}.` });
    if (v.instalments.some((i, k) => k > 0 && i.dueDate < v.instalments[k - 1].dueDate)) throw new ValidationError({ instalments: "Put the instalments in the order they fall due." });
  }
  if (v.status === "ACTIVE") {
    const [clash] = await db
      .select({ id: tuitionRequirements.id })
      .from(tuitionRequirements)
      .where(
        and(
          eq(tuitionRequirements.institutionId, institutionId),
          eq(tuitionRequirements.category, v.category),
          eq(tuitionRequirements.status, "ACTIVE"),
          v.programId ? eq(tuitionRequirements.programId, v.programId) : isNull(tuitionRequirements.programId),
          v.academicYearId ? eq(tuitionRequirements.academicYearId, v.academicYearId) : isNull(tuitionRequirements.academicYearId),
          exceptId ? ne(tuitionRequirements.id, exceptId) : undefined
        )
      )
      .limit(1);
    if (clash) throw new ConflictError("Another active requirement already covers these students. Change or deactivate it first.", { field: "programId" });
  }
}

const requirementRows = (db: Executor) =>
  db
    .select({ r: tuitionRequirements, program: programs.name, year: parameters.label })
    .from(tuitionRequirements)
    .leftJoin(programs, eq(programs.id, tuitionRequirements.programId))
    .leftJoin(parameters, eq(parameters.id, tuitionRequirements.academicYearId));

const presentRequirement = (x: { r: typeof tuitionRequirements.$inferSelect; program: string | null; year: string | null }) => ({
  ...x.r,
  programName: x.program ?? "All programs",
  academicYear: x.year ?? "Any year",
  instalments: x.r.instalments.length ? x.r.instalments : [],
});

export async function listRequirements(user: PublicUser) {
  const rows = await requirementRows(getDb())
    .where(eq(tuitionRequirements.institutionId, institutionOf(user)))
    .orderBy(asc(tuitionRequirements.category), asc(programs.name));
  return rows.map(presentRequirement);
}

async function getRequirement(user: PublicUser, id: string) {
  const [row] = await requirementRows(getDb())
    .where(and(eq(tuitionRequirements.id, id), eq(tuitionRequirements.institutionId, institutionOf(user))))
    .limit(1);
  if (!row) throw new NotFoundError("Tuition requirement");
  return presentRequirement(row);
}

const assertManager = (user: PublicUser) => {
  if (user.role !== "INSTITUTION_ADMIN") throw new ForbiddenError("Only an institution administrator can change tuition requirements.");
};

export async function createRequirement(user: PublicUser, input: unknown) {
  assertManager(user);
  const institutionId = institutionOf(user);
  const v = parseWith(requirementSchema, input);
  const id = newId("tre");
  await getDb().transaction(async (tx) => {
    await checkRequirement(tx, institutionId, v);
    await tx.insert(tuitionRequirements).values({ id, institutionId, ...v, updatedBy: user.id });
    await audit(tx, { action: "create", entityType: "tuition-requirement", entityId: id, institutionId, after: v });
  });
  return getRequirement(user, id);
}

/** Changes apply to students admitted from now on: accounts already open keep the amount they were opened with. */
export async function updateRequirement(user: PublicUser, id: string, input: unknown) {
  assertManager(user);
  const institutionId = institutionOf(user);
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(tuitionRequirements).where(and(eq(tuitionRequirements.id, id), eq(tuitionRequirements.institutionId, institutionId))).limit(1);
    if (!before) throw new NotFoundError("Tuition requirement");
    const v = parseWith(requirementSchema, { ...before, ...(input as object) });
    await checkRequirement(tx, institutionId, v, id);
    await tx.update(tuitionRequirements).set({ ...v, updatedBy: user.id }).where(eq(tuitionRequirements.id, id));
    await audit(tx, { action: "update", entityType: "tuition-requirement", entityId: id, institutionId, before, after: v });
  });
  return getRequirement(user, id);
}

// ---------------------------------------------------------------------------
// Opening an account
// ---------------------------------------------------------------------------

const categoryOf = feeCategoryOf;

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * What the student owes: the most specific active requirement for them
 * (their program before all programs, their year before any year); else
 * the institution's "tuition" fee schedule entry; else the platform's
 * default tuition fee. Without instalments it is one payment, due 30 days
 * after taking up the offer.
 */
async function tuitionFor(db: Executor, p: { institutionId: string; programId: string; academicYearId: string | null; category: "national" | "international"; acceptedAt: Date }) {
  const [req] = await db
    .select()
    .from(tuitionRequirements)
    .where(
      and(
        eq(tuitionRequirements.institutionId, p.institutionId),
        eq(tuitionRequirements.category, p.category),
        eq(tuitionRequirements.status, "ACTIVE"),
        or(isNull(tuitionRequirements.programId), eq(tuitionRequirements.programId, p.programId)),
        p.academicYearId ? or(isNull(tuitionRequirements.academicYearId), eq(tuitionRequirements.academicYearId, p.academicYearId)) : isNull(tuitionRequirements.academicYearId)
      )
    )
    .orderBy(sql`${tuitionRequirements.programId} IS NULL`, sql`${tuitionRequirements.academicYearId} IS NULL`)
    .limit(1);
  const single = (amount: number): Instalment[] => [{ label: "Payment in full", dueDate: addDays(p.acceptedAt, 30), amount }];
  if (req) return { requirementId: req.id, currency: req.currency, amount: req.amount, instalments: req.instalments.length ? req.instalments : single(req.amount) };
  const today = new Date().toISOString().slice(0, 10);
  const [fee] = await db
    .select()
    .from(feeConfigs)
    .where(and(eq(feeConfigs.institutionId, p.institutionId), eq(feeConfigs.type, "tuition"), eq(feeConfigs.category, p.category), eq(feeConfigs.status, "ACTIVE"), sql`${feeConfigs.effectiveDate} <= ${today}`, or(isNull(feeConfigs.effectiveTo), sql`${feeConfigs.effectiveTo} >= ${today}`)))
    .orderBy(desc(feeConfigs.effectiveDate))
    .limit(1);
  if (fee) return { requirementId: null, currency: fee.currency, amount: fee.amount, instalments: single(fee.amount) };
  const [type] = await db.select({ attrs: parameters.attrs }).from(parameters).where(eq(parameters.id, "fee-types:TUI")).limit(1);
  const amount = Math.round(Number(type?.attrs?.defaultAmount ?? 0) * (p.category === "international" ? 2 : 1));
  return { requirementId: null, currency: "XAF", amount, instalments: single(amount) };
}

/**
 * Opens the tuition account for an admission the applicant has taken up.
 * Called in the same transaction. Does nothing if it is already open.
 */
export async function openTuitionAccount(tx: Executor, admissionId: string) {
  const [existing] = await tx.select({ id: tuitionAccounts.id }).from(tuitionAccounts).where(eq(tuitionAccounts.admissionId, admissionId)).limit(1);
  if (existing) return existing.id;
  const [a] = await tx
    .select({ admission: admissions, institutionId: applicationInstitutions.institutionId, academicYearId: applications.academicYearId, nationality: demographicProfiles.nationality })
    .from(admissions)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .leftJoin(demographicProfiles, eq(demographicProfiles.userId, applications.applicantId))
    .where(eq(admissions.id, admissionId))
    .limit(1);
  if (!a) throw new NotFoundError("Admission");
  const category = categoryOf(a.nationality);
  const acceptedAt = a.admission.respondedAt ?? new Date();
  const t = await tuitionFor(tx, { institutionId: a.institutionId, programId: a.admission.programId, academicYearId: a.academicYearId, category, acceptedAt });
  const id = newId("tui");
  await tx.insert(tuitionAccounts).values({
    id,
    admissionId,
    institutionId: a.institutionId,
    requirementId: t.requirementId,
    category,
    currency: t.currency,
    academicYearId: a.academicYearId,
    feeCategoryId: category === "national" ? "fee-categories:NAT" : "fee-categories:INT",
    tuitionAmount: t.amount,
    instalments: t.instalments,
    offerAccepted: true,
  }).onConflictDoNothing();
  // Medical requirements are opened with the account.
  await syncMedicalRecords(tx, id);
  await audit(tx, { action: "open", entityType: "tuition-account", entityId: id, institutionId: a.institutionId, after: { admissionId, amount: t.amount, currency: t.currency, requirementId: t.requirementId, category } });
  return id;
}

/** Accounts for offers taken up before tuition accounts were opened automatically. A no-op once done. */
export async function openMissingTuitionAccounts(db: Executor) {
  const missing = await db
    .select({ id: admissions.id })
    .from(admissions)
    .leftJoin(tuitionAccounts, eq(tuitionAccounts.admissionId, admissions.id))
    .where(and(eq(admissions.status, "ACCEPTED"), isNull(tuitionAccounts.id)));
  for (const m of missing) await openTuitionAccount(db, m.id);
  // Older accounts don't know their institution yet.
  await db.execute(sql`UPDATE tuition_accounts t SET institution_id = ai.institution_id FROM admissions a JOIN application_institutions ai ON ai.id = a.application_institution_id WHERE a.id = t.admission_id AND t.institution_id IS NULL`);
  return missing.length;
}

// ---------------------------------------------------------------------------
// Reading accounts
// ---------------------------------------------------------------------------

type Viewer = "admin" | "student";

async function loadAccounts(db: Executor, where: SQL | undefined, viewer: Viewer) {
  const rows = await db
    .select({
      t: tuitionAccounts,
      applicationId: applicationInstitutions.id,
      applicationRef: sql<string>`coalesce(${applicationInstitutions.applicationNumber}, ${applicationInstitutions.reference})`,
      studentId: users.id,
      studentName: users.fullName,
      email: users.email,
      phone: users.phone,
      registrationNo: applicantProfiles.registrationNo,
      institutionId: applicationInstitutions.institutionId,
      institutionName: institutions.name,
      programName: programs.name,
      admittedAt: admissions.offeredAt,
      admissionNumber: admissions.admissionNumber,
    })
    .from(tuitionAccounts)
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .innerJoin(programs, eq(programs.id, admissions.programId))
    .where(where)
    .orderBy(desc(tuitionAccounts.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.t.id);
  const pays = await db
    .select({ p: tuitionPayments, methodLabel: institutionPaymentMethods.label, methodType: institutionPaymentMethods.type, receiptName: files.originalName, receivedByName: users.fullName })
    .from(tuitionPayments)
    .leftJoin(institutionPaymentMethods, eq(institutionPaymentMethods.id, tuitionPayments.paymentMethodId))
    .leftJoin(files, eq(files.id, tuitionPayments.receiptFileId))
    .leftJoin(users, eq(users.id, tuitionPayments.receivedBy))
    .where(inArray(tuitionPayments.accountId, ids))
    .orderBy(asc(tuitionPayments.createdAt));
  const reviews = pays.length
    ? await db
        .select({ r: tuitionPaymentReviews, by: users.fullName })
        .from(tuitionPaymentReviews)
        .leftJoin(users, eq(users.id, tuitionPaymentReviews.byUserId))
        .where(inArray(tuitionPaymentReviews.paymentId, pays.map((p) => p.p.id)))
        .orderBy(asc(tuitionPaymentReviews.at))
    : [];
  const reviewsOf = (id: string) =>
    reviews
      .filter((r) => r.r.paymentId === id)
      .map((r) => ({
        at: r.r.at.toISOString(),
        action: r.r.action,
        // Students see who at Cheeta checked their payment as "Cheeta administration".
        by: r.r.byRole === "admin" && viewer === "student" ? "Cheeta administration" : r.by ?? "",
        role: r.r.byRole,
        ...(r.r.reasonId ? { reasonId: r.r.reasonId } : {}),
        note: r.r.note,
      }));

  return rows.map((r) => {
    const payments: (TuitionPayment & { paymentMethodId: string | null; methodLabel: string; receiptFileId: string | null; receiptUrl: string | null; rejectionReason: string | null; verifiedAt: string | null })[] = pays
      .filter((p) => p.p.accountId === r.t.id)
      .map(({ p, methodLabel, methodType, receiptName, receivedByName }) => ({
        id: p.id,
        methodId: methodType ?? "",
        paymentMethodId: p.paymentMethodId,
        methodLabel: methodLabel ?? "",
        reference: p.reference,
        amount: p.amount,
        paidOn: String(p.paidOn),
        payerName: p.payerName,
        receiptFile: receiptName ?? null,
        receiptFileId: p.receiptFileId,
        receiptUrl: p.receiptFileId ? `/api/files/${encodeURIComponent(p.receiptFileId)}` : null,
        recordedAt: p.createdAt.toISOString(),
        status: p.status,
        reviews: reviewsOf(p.id),
        bankCode: p.bankCode,
        verifiedAt: p.verifiedAt?.toISOString() ?? null,
        rejectionReason: p.rejectionReason,
        receivedAt: p.receivedAt?.toISOString() ?? null,
        receivedBy: p.receivedAt ? receivedByName ?? "Institution" : null,
      }));
    const account: TuitionAccount & { currency: string; category: string | null; institutionName: string; admissionNumber: string | null } = {
      id: r.t.id,
      applicationId: r.applicationId,
      applicationRef: r.applicationRef,
      studentId: r.studentId,
      studentName: r.studentName,
      registrationNo: r.registrationNo ?? "",
      email: r.email,
      phone: r.phone ?? "",
      institutionId: r.institutionId,
      institutionName: r.institutionName,
      programName: r.programName,
      academicYearId: r.t.academicYearId ?? "",
      feeCategoryId: r.t.feeCategoryId ?? "",
      tuitionAmount: r.t.tuitionAmount,
      currency: r.t.currency,
      category: r.t.category,
      admissionNumber: r.admissionNumber,
      admittedAt: (r.admittedAt ?? r.t.createdAt).toISOString(),
      offerAccepted: r.t.offerAccepted,
      instalments: r.t.instalments,
      payments,
    };
    return { ...account, figures: figures(account, new Date().toISOString().slice(0, 10)) };
  });
}

const listQuery = pagination.extend({
  institutionId: z.string().max(100).optional(),
  verification: z.enum(["NO_PAYMENTS", "AWAITING", "QUERIED", "PARTLY_VERIFIED", "VERIFIED", "REJECTED"]).optional(),
  q: z.string().trim().max(100).optional(),
});

/** Cheeta administration: every account, with what needs checking first. */
export async function listAccountsForAdmin(req: NextRequest) {
  const q = parseQuery(req, listQuery);
  const like = q.q ? `%${q.q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const all = await loadAccounts(
    getDb(),
    and(
      q.institutionId ? eq(applicationInstitutions.institutionId, q.institutionId) : undefined,
      like ? or(sql`${users.fullName} ILIKE ${like}`, sql`${applicationInstitutions.applicationNumber} ILIKE ${like}`, sql`${users.email} ILIKE ${like}`, sql`${tuitionAccounts.id} IN (SELECT account_id FROM tuition_payments WHERE reference ILIKE ${like} OR bank_code ILIKE ${like})`) : undefined
    ),
    "admin"
  );
  const counts = all.reduce<Record<string, number>>((c, a) => ((c[a.figures.verificationStatus] = (c[a.figures.verificationStatus] ?? 0) + 1), c), {});
  const filtered = q.verification ? all.filter((a) => a.figures.verificationStatus === q.verification) : all;
  // Waiting longest first, then everything else newest first.
  const order: VerificationStatus[] = ["QUERIED", "AWAITING", "PARTLY_VERIFIED", "NO_PAYMENTS", "REJECTED", "VERIFIED"];
  filtered.sort((x, y) => order.indexOf(x.figures.verificationStatus) - order.indexOf(y.figures.verificationStatus) || (x.figures.oldestPendingAt ?? "~").localeCompare(y.figures.oldestPendingAt ?? "~"));
  return { data: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), meta: { page: q.page, pageSize: q.pageSize, total: filtered.length }, counts };
}

export async function getAccountForAdmin(id: string) {
  const [a] = await loadAccounts(getDb(), eq(tuitionAccounts.id, id), "admin");
  if (!a) throw new NotFoundError("Tuition account");
  return a;
}

/** The student's own accounts (one per offer taken up), with the institution's payment methods that accept tuition. */
export async function listMine(user: PublicUser) {
  const db = getDb();
  const accounts = await loadAccounts(db, eq(applications.applicantId, user.id), "student");
  const instIds = [...new Set(accounts.map((a) => a.institutionId))];
  const methods = instIds.length
    ? await db
        .select({ id: institutionPaymentMethods.id, institutionId: institutionPaymentMethods.institutionId, label: institutionPaymentMethods.label, type: institutionPaymentMethods.type, provider: institutionPaymentMethods.provider, accountName: institutionPaymentMethods.accountName, accountNumber: institutionPaymentMethods.accountNumber, instructions: institutionPaymentMethods.instructions })
        .from(institutionPaymentMethods)
        .where(and(inArray(institutionPaymentMethods.institutionId, instIds), eq(institutionPaymentMethods.acceptsTuition, true), eq(institutionPaymentMethods.status, "ACTIVE"), eq(institutionPaymentMethods.verification, "VERIFIED")))
    : [];
  return accounts.map((a) => ({ ...a, paymentMethods: methods.filter((m) => m.institutionId === a.institutionId) }));
}

const assertInstitutionAccess = (db: Executor, user: PublicUser) => assertPermission(db, user, "PAYMENTS_UPLOADS", "Tuition needs the \"Student Payments & Uploads\" permission.");

/**
 * The institution's view: each admitted student's tuition as the
 * institution may see it. Masked until Cheeta has verified a payment;
 * amounts awaiting verification are never shown, only counted; rejected
 * payments not at all.
 */
export async function listForInstitution(user: PublicUser) {
  const db = getDb();
  await assertInstitutionAccess(db, user);
  const accounts = await loadAccounts(db, eq(applicationInstitutions.institutionId, institutionOf(user)), "admin");
  return accounts.map((a) => {
    const view = institutionTuitionView(a);
    return { ...view, currency: a.currency, instalments: view.masked ? [] : a.instalments, admittedAt: view.masked ? null : a.admittedAt };
  });
}

export async function getForInstitution(user: PublicUser, id: string) {
  const db = getDb();
  await assertInstitutionAccess(db, user);
  const [a] = await loadAccounts(db, and(eq(tuitionAccounts.id, id), eq(applicationInstitutions.institutionId, institutionOf(user))), "admin");
  if (!a) throw new NotFoundError("Tuition account");
  const view = institutionTuitionView(a);
  return { ...view, currency: a.currency, instalments: view.masked ? [] : a.instalments, admittedAt: view.masked ? null : a.admittedAt };
}

// ---------------------------------------------------------------------------
// Recording payments (the student)
// ---------------------------------------------------------------------------

const recordSchema = z.object({
  paymentMethodId: z.string({ error: "Choose how you paid." }).min(1, "Choose how you paid.").max(100),
  reference: z.string({ error: "Enter the payment reference." }).trim().min(3, "Enter the payment reference.").max(80),
  amount: z.number({ error: "Enter the amount paid." }).int("Enter the amount in whole units.").positive("Enter the amount paid.").max(100_000_000),
  paidOn: isoDate,
  payerName: z.string({ error: "Enter the name of the person who paid." }).trim().min(2, "Enter the name of the person who paid.").max(200),
  receiptFileId: z.string().max(100).nullable().optional(),
});

async function ownAccount(db: Executor, user: PublicUser, accountId: string) {
  const [a] = await db
    .select({ id: tuitionAccounts.id, institutionId: applicationInstitutions.institutionId, applicationId: applicationInstitutions.id, admissionStatus: admissions.status })
    .from(tuitionAccounts)
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .where(and(eq(tuitionAccounts.id, accountId), eq(applications.applicantId, user.id)))
    .limit(1);
  if (!a) throw new NotFoundError("Tuition account");
  return a;
}

const isLiveReferenceClash = (err: unknown) => String((err as { cause?: { constraint?: string }; constraint?: string })?.cause?.constraint ?? (err as { constraint?: string })?.constraint ?? err).includes("tuition_payments_live_reference_unique");

export async function recordPayment(user: PublicUser, accountId: string, input: unknown) {
  const v = parseWith(recordSchema, input);
  const db = getDb();
  const a = await ownAccount(db, user, accountId);
  if (v.paidOn > new Date().toISOString().slice(0, 10)) throw new ValidationError({ paidOn: "The payment date can't be in the future." });
  const [method] = await db
    .select({ id: institutionPaymentMethods.id })
    .from(institutionPaymentMethods)
    .where(and(eq(institutionPaymentMethods.id, v.paymentMethodId), eq(institutionPaymentMethods.institutionId, a.institutionId), eq(institutionPaymentMethods.acceptsTuition, true), eq(institutionPaymentMethods.status, "ACTIVE"), eq(institutionPaymentMethods.verification, "VERIFIED")))
    .limit(1);
  if (!method) throw new ValidationError({ paymentMethodId: "Choose one of the institution's ways to pay tuition." });
  if (v.receiptFileId) {
    const [f] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, v.receiptFileId), eq(files.ownerUserId, user.id), eq(files.purpose, "payment-receipt"), isNull(files.deletedAt))).limit(1);
    if (!f) throw new ValidationError({ receiptFileId: "Upload the receipt again." });
  }
  const id = newId("tpy");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tuitionPayments).values({ id, accountId, paymentMethodId: v.paymentMethodId, reference: v.reference, amount: v.amount, paidOn: v.paidOn, payerName: v.payerName, receiptFileId: v.receiptFileId ?? null, status: "PENDING", recordedBy: user.id });
      await tx.insert(tuitionPaymentReviews).values({ id: newId("trv"), paymentId: id, action: "RECORDED", byUserId: user.id, byRole: "student", note: "" });
      await audit(tx, { action: "record", entityType: "tuition-payment", entityId: id, institutionId: a.institutionId, after: { reference: v.reference, amount: v.amount, paidOn: v.paidOn } });
      await notifyEvent(tx, {
        event: "tuition.payment_recorded",
        to: { userId: user.id },
        applicationId: a.applicationId,
        values: { "payment.amount": v.amount.toLocaleString("en-US"), "payment.reference": v.reference },
        inApp: { title: "Tuition payment recorded", summary: `We've recorded your payment ${v.reference}. Cheeta administration will check it before it counts towards your tuition.`, category: "PAYMENT" },
        action: { label: "View tuition", href: "/student/tuition" },
      });
      await notify(tx, { audience: "admin", category: "PAYMENT", title: "Tuition payment to verify", summary: `${v.reference}, ${v.amount.toLocaleString("en-US")}.`, action: { label: "Tuition verification", href: `/admin/tuition/${accountId}` } });
    });
  } catch (err) {
    if (isLiveReferenceClash(err)) throw new ConflictError("This payment reference is already on another payment. Check it, or contact support if it really is yours.", { field: "reference" });
    throw err;
  }
  return (await listMine(user)).find((x) => x.id === accountId)!;
}

/** The student's answer to a query: the payment goes back for checking. */
export async function answerQuery(user: PublicUser, paymentId: string, input: unknown) {
  const { note } = parseWith(z.object({ note: z.string({ error: "Write your answer." }).trim().min(3, "Write your answer.").max(1000) }), input);
  const db = getDb();
  const [p] = await db.select({ accountId: tuitionPayments.accountId }).from(tuitionPayments).where(eq(tuitionPayments.id, paymentId)).limit(1);
  if (!p) throw new NotFoundError("Payment");
  const a = await ownAccount(db, user, p.accountId);
  await db.transaction(async (tx) => {
    const [moved] = await tx.update(tuitionPayments).set({ status: "PENDING" }).where(and(eq(tuitionPayments.id, paymentId), eq(tuitionPayments.status, "QUERIED"))).returning({ id: tuitionPayments.id });
    if (!moved) throw new ConflictError("There is no open query on this payment.");
    await tx.insert(tuitionPaymentReviews).values({ id: newId("trv"), paymentId, action: "ANSWERED", byUserId: user.id, byRole: "student", note });
    await audit(tx, { action: "answer", entityType: "tuition-payment", entityId: paymentId, institutionId: a.institutionId, after: { status: "PENDING" } });
    await notify(tx, { audience: "admin", category: "PAYMENT", title: "Tuition query answered", summary: note.slice(0, 200), action: { label: "Tuition verification", href: `/admin/tuition/${p.accountId}` } });
  });
  return (await listMine(user)).find((x) => x.id === p.accountId)!;
}

// ---------------------------------------------------------------------------
// Verification (Cheeta administration)
// ---------------------------------------------------------------------------

const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), note: text(1000).default("") }),
  z.object({ action: z.literal("query"), note: z.string({ error: "Say what you need to know." }).trim().min(3, "Say what you need to know.").max(1000) }),
  z.object({ action: z.literal("reject"), reasonId: z.string().max(200).optional(), note: text(1000).default("") }),
  z.object({ action: z.literal("reopen"), note: z.string({ error: "Say why it is being reopened." }).trim().min(3, "Say why it is being reopened.").max(1000) }),
]);

const FROM: Record<string, ("PENDING" | "QUERIED" | "VERIFIED" | "REJECTED")[]> = {
  verify: ["PENDING", "QUERIED"],
  query: ["PENDING"],
  reject: ["PENDING", "QUERIED"],
  reopen: ["VERIFIED", "REJECTED"],
};

/**
 * Verify, query, reject or reopen one payment. Each is only possible from
 * the states listed in FROM, checked in the update itself, so two
 * administrators acting at once can't both succeed. Verifying is the only
 * way a payment comes to count towards the tuition.
 */
export async function reviewTuitionPayment(user: PublicUser, paymentId: string, input: unknown) {
  const v = parseWith(reviewSchema, input);
  const db = getDb();
  const [p] = await db
    .select({ p: tuitionPayments, institutionId: tuitionAccounts.institutionId, applicantId: applications.applicantId, applicationId: applicationInstitutions.id, admissionId: tuitionAccounts.admissionId })
    .from(tuitionPayments)
    .innerJoin(tuitionAccounts, eq(tuitionAccounts.id, tuitionPayments.accountId))
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .where(eq(tuitionPayments.id, paymentId))
    .limit(1);
  if (!p) throw new NotFoundError("Payment");
  if (!FROM[v.action].includes(p.p.status)) throw new ConflictError(`This payment is ${p.p.status.toLowerCase()}, so it can't be ${{ verify: "verified", query: "queried", reject: "rejected", reopen: "reopened" }[v.action]}.`);
  if (v.action === "reopen" && p.p.receivedAt) throw new ConflictError("The institution has already marked this payment received. Ask it to undo that first.");

  let reason: string | null = null;
  let reasonId: string | null = null;
  if (v.action === "reject") {
    if (v.reasonId) {
      const [standard] = await db.select().from(parameters).where(and(eq(parameters.id, v.reasonId), eq(parameters.category, "rejection-reasons"), eq(parameters.status, "ACTIVE"))).limit(1);
      if (!standard || standard.attrs?.appliesTo !== "payment") throw new ValidationError({ reasonId: "Choose a reason from the list." });
      reasonId = standard.id;
      reason = v.note ? `${standard.label}. ${v.note}` : standard.label;
    } else if (v.note.trim().length >= 3) reason = v.note.trim();
    else throw new ValidationError({ reasonId: "Give a reason: the student is told it." });
  }

  await db.transaction(async (tx) => {
    let bankCode: string | null = null;
    if (v.action === "verify") {
      for (let attempt = 0; attempt < 5 && !bankCode; attempt++) {
        const candidate = makeBankCode("T", new Date().getUTCFullYear());
        const [clash] = await tx.select({ id: tuitionPayments.id }).from(tuitionPayments).where(eq(tuitionPayments.bankCode, candidate)).limit(1);
        if (!clash) bankCode = candidate;
      }
      if (!bankCode) throw new ConflictError("Couldn't issue a unique bank code. Try again.");
    }
    const status = { verify: "VERIFIED", query: "QUERIED", reject: "REJECTED", reopen: "PENDING" }[v.action] as "VERIFIED" | "QUERIED" | "REJECTED" | "PENDING";
    let moved: { id: string }[];
    try {
      moved = await tx
        .update(tuitionPayments)
        .set({
          status,
          ...(v.action === "verify" ? { bankCode, verifiedAt: new Date(), verifiedBy: user.id, rejectionReason: null } : {}),
          ...(v.action === "reject" ? { rejectionReason: reason, bankCode: null } : {}),
          ...(v.action === "reopen" ? { bankCode: null, verifiedAt: null, verifiedBy: null, rejectionReason: null } : {}),
        })
        .where(and(eq(tuitionPayments.id, paymentId), inArray(tuitionPayments.status, FROM[v.action]), v.action === "reopen" ? isNull(tuitionPayments.receivedAt) : undefined))
        .returning({ id: tuitionPayments.id });
    } catch (err) {
      // Reopening a rejected payment whose reference has been used again since.
      if (isLiveReferenceClash(err)) throw new ConflictError("Another payment now uses this reference, so this one can't be reopened.");
      throw err;
    }
    if (!moved.length) throw new ConflictError("This payment has just been changed by someone else. Reload it and try again.");
    const action = { verify: "VERIFIED", query: "QUERIED", reject: "REJECTED", reopen: "REOPENED" }[v.action] as "VERIFIED" | "QUERIED" | "REJECTED" | "REOPENED";
    await tx.insert(tuitionPaymentReviews).values({ id: newId("trv"), paymentId, action, byUserId: user.id, byRole: "admin", reasonId, note: v.action === "reject" && !reasonId ? reason ?? "" : v.note });
    await audit(tx, { action: v.action, entityType: "tuition-payment", entityId: paymentId, institutionId: p.institutionId, before: { status: p.p.status }, after: { status, bankCode, rejectionReason: reason } });

    // What the student is told, with the figures as they now stand.
    const [acct] = await loadAccounts(tx, eq(tuitionAccounts.id, p.p.accountId), "admin");
    const f = acct.figures;
    const money = (n: number) => `${n.toLocaleString("en-US")} ${acct.currency}`;
    const values = { "payment.amount": money(p.p.amount), "payment.reference": p.p.reference, "tuition.amount": money(f.tuition), "tuition.outstanding": money(f.outstanding), reason: reason ?? "" };
    const action$ = { label: "View tuition", href: "/student/tuition" };
    if (v.action === "verify") {
      await notifyEvent(tx, { event: "verification.tuition_verified", to: { userId: p.applicantId }, applicationId: p.applicationId, values, inApp: { title: "Tuition payment verified", summary: `Your payment ${p.p.reference} is verified. Still to pay: ${money(f.outstanding)}.`, category: "VERIFICATION" }, action: action$ });
      await notify(tx, { audience: "institution", institutionId: p.institutionId, category: "PAYMENT", title: `Tuition payment verified: ${bankCode}`, summary: `${money(p.p.amount)} verified by Cheeta administration. Mark it received once it is on your statement.`, action: { label: "Open tuition", href: `/institution/tuition/${p.p.accountId}` } });
    } else if (v.action === "reject") {
      await notifyEvent(tx, { event: "rejection.tuition_rejected", to: { userId: p.applicantId }, applicationId: p.applicationId, values, inApp: { title: "Tuition payment not accepted", summary: `Your payment ${p.p.reference} couldn't be verified: ${reason}`, category: "REJECTION" }, important: true, action: action$ });
    } else if (v.action === "query") {
      await notify(tx, { audience: "student", recipientUserId: p.applicantId, category: "PAYMENT", title: "Question about your tuition payment", summary: `About ${p.p.reference}: ${v.note}`, important: true, action: { label: "Answer", href: "/student/tuition" } });
    } else {
      await notify(tx, { audience: "student", recipientUserId: p.applicantId, category: "PAYMENT", title: "Your tuition payment is being checked again", summary: `${p.p.reference}: ${v.note}`, action: action$ });
    }
  });
  return getAccountForAdmin(p.p.accountId);
}

// ---------------------------------------------------------------------------
// Reconciliation (the institution)
// ---------------------------------------------------------------------------

/** The institution confirms (or takes back) that a verified payment is on its own statement. */
export async function markReceived(user: PublicUser, paymentId: string, input: unknown) {
  const { received } = parseWith(z.object({ received: z.boolean() }), input);
  const db = getDb();
  await assertInstitutionAccess(db, user);
  const institutionId = institutionOf(user);
  const [p] = await db
    .select({ p: tuitionPayments })
    .from(tuitionPayments)
    .innerJoin(tuitionAccounts, eq(tuitionAccounts.id, tuitionPayments.accountId))
    .where(and(eq(tuitionPayments.id, paymentId), eq(tuitionAccounts.institutionId, institutionId)))
    .limit(1);
  // A payment Cheeta hasn't verified doesn't exist for the institution.
  if (!p || p.p.status !== "VERIFIED") throw new NotFoundError("Payment");
  await db.transaction(async (tx) => {
    await tx.update(tuitionPayments).set(received ? { receivedAt: new Date(), receivedBy: user.id } : { receivedAt: null, receivedBy: null }).where(and(eq(tuitionPayments.id, paymentId), eq(tuitionPayments.status, "VERIFIED")));
    await audit(tx, { action: received ? "received" : "unreceived", entityType: "tuition-payment", entityId: paymentId, institutionId, before: { receivedAt: p.p.receivedAt }, after: { received } });
  });
  return getForInstitution(user, p.p.accountId);
}

/** Finds a verified tuition payment of this institution by its bank code. */
export async function findByBankCode(user: PublicUser, code: string) {
  const db = getDb();
  await assertInstitutionAccess(db, user);
  const [p] = await db
    .select({ accountId: tuitionPayments.accountId })
    .from(tuitionPayments)
    .innerJoin(tuitionAccounts, eq(tuitionAccounts.id, tuitionPayments.accountId))
    .where(and(eq(tuitionPayments.bankCode, code.trim().toUpperCase()), eq(tuitionPayments.status, "VERIFIED"), eq(tuitionAccounts.institutionId, institutionOf(user))))
    .limit(1);
  if (!p) throw new NotFoundError("Payment");
  return getForInstitution(user, p.accountId);
}

/** For reports: accounts with their payments and figures, as Cheeta administration sees them. */
export { loadAccounts as loadTuitionAccounts };
