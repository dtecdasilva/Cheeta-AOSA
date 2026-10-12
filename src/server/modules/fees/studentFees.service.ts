import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import type { PublicUser } from "@/lib/auth/users";
import type { DisplayAmounts, FeeLine, FeeState, FeeSummary, PayableInstitution } from "@/lib/fees/types";
import { PAYMENT_METHOD_TYPES, type PaymentMethodType } from "@/lib/institution/paymentMethods";
import { roundTo } from "@/lib/currency/money";
import { getDb, type Executor } from "@/server/db/client";
import { applicantProfiles, applicationInstitutions, applications, currencies, feePayments, institutionPaymentMethods, institutions, parameters } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { ValidationError } from "@/server/http/errors";
import { parseWith } from "@/server/http/validate";
import { decimalsOf, loadSnapshots, quoteRate, type RateQuote, type RateSnapshot } from "@/server/modules/reference/conversion.service";
import { assessFee, inDisplayCurrency } from "./calculation";

/**
 * The applicant's view of what their applications cost.
 *
 * One rule decides where each figure comes from:
 *
 * - An application with no payment on it (or only rejected ones) is
 *   priced live: today's fee schedule, today's exchange rates.
 * - An application with a payment awaiting approval or approved is
 *   LOCKED. Its amounts, the rate its fee was converted at and the
 *   converted amount the applicant was shown all come from what was
 *   stored when the payment was recorded. A rate set afterwards changes
 *   nothing about it, and a different display currency chosen afterwards
 *   doesn't convert it again.
 */

/** Currencies an applicant may view fees in: active, offered to applicants, and always the base currency. */
async function offeredCurrencies(db: Executor): Promise<Set<string>> {
  const rows = await db.select({ code: currencies.code }).from(currencies).where(and(eq(currencies.status, "ACTIVE"), eq(currencies.displayToApplicants, true)));
  return new Set([BASE_CURRENCY, ...rows.map((r) => r.code)]);
}

/** The applicant's saved display currency, falling back to the base currency if it is no longer offered. */
export async function savedDisplayCurrency(db: Executor, userId: string): Promise<string> {
  const [profile] = await db.select({ displayCurrency: applicantProfiles.displayCurrency }).from(applicantProfiles).where(eq(applicantProfiles.userId, userId)).limit(1);
  const saved = profile?.displayCurrency;
  if (!saved || saved === BASE_CURRENCY) return BASE_CURRENCY;
  return (await offeredCurrencies(db)).has(saved) ? saved : BASE_CURRENCY;
}

const currencySchema = z
  .string({ error: "Choose a currency." })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Choose a currency.");

function fromSnapshot(s: RateSnapshot, decimals: number, amounts: { applicationFee: number; webFee: number; total: number }): DisplayAmounts {
  return inDisplayCurrency({ toCurrency: s.toCurrency, rate: s.rate, source: s.source, effectiveFrom: s.rateEffectiveFrom }, decimals, amounts, s.toAmount);
}

/**
 * Every application the applicant has, with what it costs.
 *
 * `currency` previews the amounts in that currency without saving it as
 * the applicant's choice; left out, their saved choice is used.
 */
export async function getMyFees(user: PublicUser, query: { currency?: unknown } = {}): Promise<FeeSummary> {
  const db = getDb();
  const saved = await savedDisplayCurrency(db, user.id);
  let displayCurrency = saved;
  if (query.currency !== undefined && query.currency !== "") {
    displayCurrency = parseWith(z.object({ currency: currencySchema }), { currency: query.currency }).currency;
    if (!(await offeredCurrencies(db)).has(displayCurrency)) throw new ValidationError({ currency: "Fees can't be shown in this currency." });
  }

  const now = new Date();
  const liveRate: RateQuote | null = displayCurrency === BASE_CURRENCY ? null : await quoteRate(db, BASE_CURRENCY, displayCurrency, now);
  const usable = liveRate?.derivation && liveRate.effectiveFrom ? { toCurrency: displayCurrency, rate: liveRate.rate, source: liveRate.source, effectiveFrom: liveRate.effectiveFrom } : null;

  const rows = await db
    .select({ ai: applicationInstitutions, institution: { id: institutions.id, name: institutions.name, webFee: institutions.webFee } })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .where(eq(applications.applicantId, user.id))
    .orderBy(asc(applicationInstitutions.createdAt));

  const payments = rows.length
    ? await db
        .select()
        .from(feePayments)
        .where(inArray(feePayments.applicationInstitutionId, rows.map((r) => r.ai.id)))
        .orderBy(desc(feePayments.submittedAt))
    : [];
  const snapshots = await loadSnapshots(db, payments.flatMap((p) => [p.feeRateSnapshotId, p.displayRateSnapshotId]));
  const decimals = await decimalsOf(db, [displayCurrency, ...[...snapshots.values()].map((s) => s.toCurrency)]);

  const lines: FeeLine[] = [];
  for (const { ai, institution } of rows) {
    const mine = payments.filter((p) => p.applicationInstitutionId === ai.id);
    const standing = mine.find((p) => p.approval === "APPROVED") ?? mine.find((p) => p.approval === "AWAITING");
    const latest = standing ?? mine[0] ?? null;
    const payment = latest
      ? { id: latest.id, method: latest.method, reference: latest.reference, paidAt: latest.paidAt.toISOString(), submittedAt: latest.submittedAt.toISOString(), approval: latest.approval, bankCode: latest.bankCode, rejectionReason: latest.approval === "REJECTED" ? latest.rejectionReason : null }
      : null;
    const head = { id: ai.id, reference: ai.reference, institution: { id: institution.id, name: institution.name } };

    if (standing) {
      // Locked: nothing below reads the fee schedule or the live rates.
      const feeSnap = snapshots.get(standing.feeRateSnapshotId ?? "");
      const displaySnap = snapshots.get(standing.displayRateSnapshotId ?? "");
      const amounts = { applicationFee: standing.applicationFee, webFee: standing.webFee, total: standing.amount };
      lines.push({
        ...head,
        state: standing.approval === "APPROVED" ? "PAID" : "AWAITING",
        locked: true,
        currency: standing.currency,
        fee: feeSnap
          ? { name: "Application fee", currency: feeSnap.fromCurrency, amount: feeSnap.fromAmount, basePerUnit: feeSnap.rate, rateSource: feeSnap.source, rateEffectiveFrom: feeSnap.rateEffectiveFrom.toISOString() }
          : { name: "Application fee", currency: standing.currency, amount: standing.applicationFee, basePerUnit: null, rateSource: null, rateEffectiveFrom: null },
        ...amounts,
        display: displaySnap ? { ...fromSnapshot(displaySnap, decimals.get(displaySnap.toCurrency) ?? 2, amounts), asAtPayment: true } : null,
        payment,
        reason: null,
      });
      continue;
    }

    const a = await assessFee(db, institution, now);
    const fee = {
      name: a.fee.name,
      currency: a.fee.currency,
      amount: a.fee.amount,
      basePerUnit: a.priced && a.feeRate.derivation ? a.feeRate.rate : null,
      rateSource: a.priced && a.feeRate.derivation ? a.feeRate.source : null,
      rateEffectiveFrom: a.priced && a.feeRate.derivation ? (a.feeRate.effectiveFrom?.toISOString() ?? null) : null,
    };
    if (!a.priced) {
      lines.push({ ...head, state: "UNPRICED", locked: false, currency: a.currency, fee, applicationFee: null, webFee: a.webFee, total: null, display: null, payment, reason: a.reason });
      continue;
    }
    const amounts = { applicationFee: a.applicationFee, webFee: a.webFee, total: a.amount };
    lines.push({
      ...head,
      state: latest?.approval === "REJECTED" ? "REJECTED" : "UNPAID",
      locked: false,
      currency: a.currency,
      fee,
      ...amounts,
      display: usable ? { ...inDisplayCurrency(usable, decimals.get(displayCurrency) ?? 2, amounts), asAtPayment: false } : null,
      payment,
      reason: null,
    });
  }

  const sum = (states: FeeState[]) => lines.filter((l) => states.includes(l.state)).reduce((s, l) => s + (l.total ?? 0), 0);
  const outstanding = sum(["UNPAID", "REJECTED"]);
  return {
    baseCurrency: BASE_CURRENCY,
    displayCurrency,
    savedDisplayCurrency: saved,
    rate: usable ? { currency: displayCurrency, rate: usable.rate, basePerUnit: roundTo(1 / usable.rate, 6), source: usable.source, effectiveFrom: usable.effectiveFrom.toISOString() } : null,
    conversionUnavailable: displayCurrency !== BASE_CURRENCY && !usable,
    applications: lines,
    totals: {
      // Converted as one figure at today's rate, so it is not a sum of rounded parts.
      outstanding: { base: outstanding, display: usable ? inDisplayCurrency(usable, decimals.get(displayCurrency) ?? 2, { applicationFee: 0, webFee: 0, total: outstanding }).total : null },
      awaiting: { base: sum(["AWAITING"]) },
      paid: { base: sum(["PAID"]) },
    },
  };
}

/** Saves the currency the applicant wants fees shown in, and returns their fees in it. */
export async function setMyDisplayCurrency(user: PublicUser, input: unknown): Promise<FeeSummary> {
  const { currency } = parseWith(z.object({ currency: currencySchema }), input);
  const db = getDb();
  if (!(await offeredCurrencies(db)).has(currency)) throw new ValidationError({ currency: "Fees can't be shown in this currency." });
  await db.transaction(async (tx) => {
    const [before] = await tx.select({ displayCurrency: applicantProfiles.displayCurrency }).from(applicantProfiles).where(eq(applicantProfiles.userId, user.id)).limit(1);
    const next = currency === BASE_CURRENCY ? null : currency;
    if (!before || before.displayCurrency === next) return;
    await tx.update(applicantProfiles).set({ displayCurrency: next }).where(eq(applicantProfiles.userId, user.id));
    await audit(tx, { action: "update", entityType: "display-currency", entityId: user.id, before: { displayCurrency: before.displayCurrency ?? BASE_CURRENCY }, after: { displayCurrency: currency } });
  });
  return getMyFees(user);
}

// ---------------------------------------------------------------------------
// Where to pay
// ---------------------------------------------------------------------------

/**
 * The accounts the applicant can pay into: for each institution they have
 * applied to, its payment methods that are active and that Cheeta
 * administration has verified. An unverified or rejected account is never
 * shown to an applicant. `type` narrows it to one kind of method.
 */
export async function listMyPaymentMethods(user: PublicUser, query: { type?: unknown } = {}): Promise<PayableInstitution[]> {
  const { type } = parseWith(z.object({ type: z.enum(PAYMENT_METHOD_TYPES, { error: "Unknown kind of payment method." }).optional() }), { type: query.type || undefined });
  const db = getDb();
  const rows = await db
    .select({ id: applicationInstitutions.id, reference: applicationInstitutions.reference, institutionId: institutions.id, institutionName: institutions.name })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .where(eq(applications.applicantId, user.id))
    .orderBy(asc(applicationInstitutions.createdAt));
  if (!rows.length) return [];

  const methods = await db
    .select()
    .from(institutionPaymentMethods)
    .where(
      and(
        inArray(institutionPaymentMethods.institutionId, [...new Set(rows.map((r) => r.institutionId))]),
        eq(institutionPaymentMethods.status, "ACTIVE"),
        eq(institutionPaymentMethods.verification, "VERIFIED"),
        type ? eq(institutionPaymentMethods.type, type) : undefined
      )
    )
    .orderBy(asc(institutionPaymentMethods.type), asc(institutionPaymentMethods.label));

  return rows.map((r) => ({
    applicationId: r.id,
    reference: r.reference,
    institution: { id: r.institutionId, name: r.institutionName },
    methods: methods
      .filter((m) => m.institutionId === r.institutionId)
      .map((m) => ({ id: m.id, type: m.type as PaymentMethodType, label: m.label, provider: m.provider, branch: m.branch, accountName: m.accountName, accountNumber: m.accountNumber, swift: m.swift, instructions: m.instructions })),
  }));
}

/** The payment channels (the platform's "Payment method types" list) an applicant may record a payment under. */
export async function allowedChannels(db: Executor, allowedIds: string[]) {
  if (!allowedIds.length) return [];
  const rows = await db
    .select({ id: parameters.id, label: parameters.label, attrs: parameters.attrs, sortOrder: parameters.sortOrder })
    .from(parameters)
    .where(and(eq(parameters.category, "payment-method-types"), eq(parameters.status, "ACTIVE"), inArray(parameters.id, allowedIds)))
    .orderBy(asc(parameters.sortOrder));
  return rows.map((r) => ({ id: r.id, label: r.label, channel: String(r.attrs?.channel ?? ""), referenceLabel: String(r.attrs?.referenceLabel ?? "Reference") }));
}
