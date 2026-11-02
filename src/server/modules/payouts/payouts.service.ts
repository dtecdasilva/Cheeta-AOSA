import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, type Executor } from "@/server/db/client";
import {
  applicationInstitutions,
  applications,
  admissions,
  feePayments,
  institutionPaymentMethods,
  institutionPayouts,
  institutions,
  tuitionAccounts,
  tuitionPayments,
  users,
} from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { notify } from "@/server/notifications/notifications.service";
import { assertPermission } from "@/server/auth/access";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith, requiredText, text } from "@/server/http/validate";
import type { PublicUser } from "@/lib/auth/users";

/**
 * Payouts: money Cheeta pays institutions.
 *
 * Applicants pay everything to Cheeta (application fee with the web fee, and tuition). An institution is
 * owed its share: the application fee of every payment Cheeta has approved (never the web fee, which is
 * Cheeta's) and every tuition payment Cheeta has verified. What it is owed now is that, less every payout
 * Cheeta has recorded and not cancelled. Nothing here is stored as a running total: it is worked out from
 * the payments and payouts themselves, so it can never drift from them.
 */

export interface Balance {
  institutionId: string;
  institutionName: string;
  applicationFees: number;
  tuition: number;
  earned: number;
  paidOut: number;
  owed: number;
  lastPaidOn: string | null;
}

/** Earned and paid, per institution (or one institution). */
async function balances(db: Executor, institutionId?: string): Promise<Balance[]> {
  const only = (col: unknown) => (institutionId ? sql`AND ${col} = ${institutionId}` : sql``);
  const fees = (await db.execute(sql`
    SELECT ai.institution_id AS id, COALESCE(SUM(f.application_fee), 0)::bigint AS total
    FROM fee_payments f JOIN application_institutions ai ON ai.id = f.application_institution_id
    WHERE f.approval = 'APPROVED' ${only(sql`ai.institution_id`)}
    GROUP BY ai.institution_id`)) as unknown as { rows: { id: string; total: string }[] };
  const tuition = (await db.execute(sql`
    SELECT ta.institution_id AS id, COALESCE(SUM(p.amount), 0)::bigint AS total
    FROM tuition_payments p JOIN tuition_accounts ta ON ta.id = p.account_id
    WHERE p.status = 'VERIFIED' AND ta.institution_id IS NOT NULL ${only(sql`ta.institution_id`)}
    GROUP BY ta.institution_id`)) as unknown as { rows: { id: string; total: string }[] };
  const paid = (await db.execute(sql`
    SELECT institution_id AS id, COALESCE(SUM(amount), 0)::bigint AS total, MAX(paid_on)::text AS last
    FROM institution_payouts WHERE cancelled_at IS NULL ${only(sql`institution_id`)}
    GROUP BY institution_id`)) as unknown as { rows: { id: string; total: string; last: string | null }[] };

  const list = await db
    .select({ id: institutions.id, name: institutions.name, status: institutions.status })
    .from(institutions)
    .where(institutionId ? eq(institutions.id, institutionId) : undefined)
    .orderBy(asc(institutions.name));
  const sum = (rows: { id: string; total: string }[], id: string) => Number(rows.find((r) => r.id === id)?.total ?? 0);
  return list.map((i) => {
    const applicationFees = sum(fees.rows, i.id);
    const tuitionTotal = sum(tuition.rows, i.id);
    const paidOut = sum(paid.rows, i.id);
    const earned = applicationFees + tuitionTotal;
    return {
      institutionId: i.id,
      institutionName: i.name,
      applicationFees,
      tuition: tuitionTotal,
      earned,
      paidOut,
      owed: earned - paidOut,
      lastPaidOn: paid.rows.find((r) => r.id === i.id)?.last ?? null,
    };
  });
}

/** Every approved application fee and verified tuition payment that counts towards what an institution is owed. */
async function earnings(db: Executor, institutionId: string) {
  const fees = await db
    .select({
      id: feePayments.id,
      at: feePayments.reviewedAt,
      bankCode: feePayments.bankCode,
      reference: applicationInstitutions.reference,
      student: users.fullName,
      amount: feePayments.applicationFee,
    })
    .from(feePayments)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, feePayments.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .where(and(eq(applicationInstitutions.institutionId, institutionId), eq(feePayments.approval, "APPROVED")));
  const tuition = await db
    .select({
      id: tuitionPayments.id,
      at: tuitionPayments.verifiedAt,
      bankCode: tuitionPayments.bankCode,
      reference: applicationInstitutions.reference,
      student: users.fullName,
      amount: tuitionPayments.amount,
    })
    .from(tuitionPayments)
    .innerJoin(tuitionAccounts, eq(tuitionAccounts.id, tuitionPayments.accountId))
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .where(and(eq(tuitionAccounts.institutionId, institutionId), eq(tuitionPayments.status, "VERIFIED")));
  return [
    ...fees.map((f) => ({ ...f, kind: "Application fee" as const })),
    ...tuition.map((t) => ({ ...t, kind: "Tuition" as const })),
  ]
    .map((r) => ({ id: r.id, kind: r.kind, at: r.at?.toISOString() ?? null, bankCode: r.bankCode ?? "", reference: r.reference, student: r.student, amount: r.amount }))
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

async function payoutsOf(db: Executor, institutionId?: string) {
  const recorder = users;
  const rows = await db
    .select({ p: institutionPayouts, institutionName: institutions.name, recordedByName: recorder.fullName })
    .from(institutionPayouts)
    .innerJoin(institutions, eq(institutions.id, institutionPayouts.institutionId))
    .leftJoin(recorder, eq(recorder.id, institutionPayouts.recordedBy))
    .where(institutionId ? eq(institutionPayouts.institutionId, institutionId) : undefined)
    .orderBy(desc(institutionPayouts.paidOn), desc(institutionPayouts.createdAt))
    .limit(institutionId ? 500 : 50);
  return rows.map(({ p, institutionName, recordedByName }) => ({
    id: p.id,
    institutionId: p.institutionId,
    institutionName,
    amount: p.amount,
    currency: p.currency,
    paidOn: p.paidOn,
    reference: p.reference,
    note: p.note,
    payoutAccount: p.payoutAccount,
    recordedBy: recordedByName ?? null,
    recordedAt: p.createdAt.toISOString(),
    cancelled: p.cancelledAt ? { at: p.cancelledAt.toISOString(), reason: p.cancelReason ?? "" } : null,
  }));
}

async function payoutAccounts(db: Executor, institutionId: string) {
  return db
    .select({ id: institutionPaymentMethods.id, type: institutionPaymentMethods.type, label: institutionPaymentMethods.label, provider: institutionPaymentMethods.provider, accountName: institutionPaymentMethods.accountName, accountNumber: institutionPaymentMethods.accountNumber })
    .from(institutionPaymentMethods)
    .where(and(eq(institutionPaymentMethods.institutionId, institutionId), eq(institutionPaymentMethods.status, "ACTIVE"), eq(institutionPaymentMethods.verification, "VERIFIED")))
    .orderBy(asc(institutionPaymentMethods.type), asc(institutionPaymentMethods.label));
}

// ---------------------------------------------------------------------------
// Cheeta administration
// ---------------------------------------------------------------------------

/** Every institution's balance, the totals, and the latest payouts. */
export async function adminOverview() {
  const db = getDb();
  const [list, recent] = await Promise.all([balances(db), payoutsOf(db)]);
  const totals = list.reduce((t, b) => ({ earned: t.earned + b.earned, paidOut: t.paidOut + b.paidOut, owed: t.owed + b.owed }), { earned: 0, paidOut: 0, owed: 0 });
  return { currency: "XAF", totals, institutions: list, recent };
}

/** One institution's statement: balance, what it has earned, every payout, and where it can be paid. */
export async function statement(institutionId: string) {
  const db = getDb();
  const [balance] = await balances(db, institutionId);
  if (!balance) throw new NotFoundError("Institution");
  const [earned, payouts, accounts] = await Promise.all([earnings(db, institutionId), payoutsOf(db, institutionId), payoutAccounts(db, institutionId)]);
  return { currency: "XAF", balance, earned, payouts, payoutAccounts: accounts };
}

const recordSchema = z.object({
  institutionId: requiredText(100),
  amount: z.number({ error: "Enter the amount paid." }).int("Enter a whole amount.").positive("Enter the amount paid."),
  paidOn: z.iso.date({ error: "Enter the date it was paid." }),
  reference: requiredText(120),
  payoutAccountId: text(100).nullish(),
  note: text(500).default(""),
});

export async function recordPayout(user: PublicUser, input: unknown) {
  const v = parseWith(recordSchema, input);
  if (v.paidOn > new Date().toISOString().slice(0, 10)) throw new ValidationError({ paidOn: "The payment date can't be in the future." });
  return getDb().transaction(async (tx) => {
    // One payout at a time per institution, so two people can't both pay out the same balance.
    const [inst] = await tx.select({ id: institutions.id, name: institutions.name }).from(institutions).where(eq(institutions.id, v.institutionId)).for("update").limit(1);
    if (!inst) throw new ValidationError({ institutionId: "Choose an institution from the list." });
    const [balance] = await balances(tx, inst.id);
    if (v.amount > balance.owed) {
      throw new ValidationError({ amount: balance.owed > 0 ? `Cheeta owes ${inst.name} ${balance.owed.toLocaleString("en-US")} XAF; a payout can't be more than that.` : `Cheeta doesn't owe ${inst.name} anything at the moment.` });
    }
    let account = null;
    if (v.payoutAccountId) {
      [account = null] = await tx
        .select()
        .from(institutionPaymentMethods)
        .where(and(eq(institutionPaymentMethods.id, v.payoutAccountId), eq(institutionPaymentMethods.institutionId, inst.id), eq(institutionPaymentMethods.verification, "VERIFIED"), eq(institutionPaymentMethods.status, "ACTIVE")))
        .limit(1);
      if (!account) throw new ValidationError({ payoutAccountId: "Choose one of the institution's verified payout accounts." });
    }
    const [row] = await tx
      .insert(institutionPayouts)
      .values({
        id: newId("pay"),
        institutionId: inst.id,
        amount: v.amount,
        paidOn: v.paidOn,
        reference: v.reference,
        note: v.note,
        payoutAccountId: account?.id ?? null,
        payoutAccount: account
          ? { type: account.type, label: account.label, provider: account.provider, branch: account.branch, accountName: account.accountName, accountNumber: account.accountNumber, swift: account.swift, bankCode: account.bankCode, branchCode: account.branchCode, rib: account.rib }
          : null,
        recordedBy: user.id,
      })
      .returning();
    await audit(tx, { action: "payout", entityType: "institution-payout", entityId: row.id, institutionId: inst.id, before: null, after: { amount: row.amount, paidOn: row.paidOn, reference: row.reference } });
    await notify(tx, {
      audience: "institution",
      institutionId: inst.id,
      category: "PAYMENT",
      title: "Payout from Cheeta AOSA",
      summary: `${v.amount.toLocaleString("en-US")} XAF paid on ${v.paidOn}, reference ${v.reference}.`,
      action: { label: "Payouts", href: "/institution/payouts" },
    });
    return row;
  });
}

const cancelSchema = z.object({ reason: requiredText(500) });

/** A payout recorded in error is cancelled, never deleted: the amount goes back on what is owed. */
export async function cancelPayout(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(cancelSchema, input);
  return getDb().transaction(async (tx) => {
    const [p] = await tx.select().from(institutionPayouts).where(eq(institutionPayouts.id, id)).for("update").limit(1);
    if (!p) throw new NotFoundError("Payout");
    if (p.cancelledAt) throw new ConflictError("This payout has already been cancelled.");
    const [row] = await tx.update(institutionPayouts).set({ cancelledAt: new Date(), cancelledBy: user.id, cancelReason: v.reason, updatedAt: new Date() }).where(eq(institutionPayouts.id, id)).returning();
    await audit(tx, { action: "cancel", entityType: "institution-payout", entityId: id, institutionId: p.institutionId, before: { cancelled: false }, after: { cancelled: true, reason: v.reason } });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Institution portal
// ---------------------------------------------------------------------------

/** The caller's own institution's statement. Needs the "Student payments & uploads" permission. */
export async function myStatement(user: PublicUser) {
  const db = getDb();
  await assertPermission(db, user, "PAYMENTS_UPLOADS", "Payouts need the \"Student Payments & Uploads\" permission.");
  if (!user.institutionId) throw new NotFoundError("Institution");
  return statement(user.institutionId);
}
