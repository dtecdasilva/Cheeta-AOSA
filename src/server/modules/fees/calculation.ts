import "server-only";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { convertAt, roundTo } from "@/lib/currency/money";
import type { DisplayAmounts } from "@/lib/fees/types";
import type { Executor } from "@/server/db/client";
import { feeConfigs, parameters } from "@/server/db/schema";
import { getSettings } from "@/server/modules/settings/settings.service";
import { decimalsOf, quoteRate, type RateQuote } from "@/server/modules/reference/conversion.service";

/**
 * What an application costs, worked out across currencies.
 *
 * Three currencies can be involved in one fee:
 *
 *   fee currency      what the institution scheduled its fee in (a fee
 *                     schedule entry has its own currency)
 *   base currency     what the platform counts in. Everything owed is an
 *                     amount in the base currency: the institution's fee
 *                     converted into it, plus the platform web fee, which
 *                     is set in it
 *   display currency  what the applicant has chosen to look at fees in.
 *                     It changes what is shown, never what is owed
 *
 * So a fee is calculated in two steps, each at the exchange rate applying
 * at that moment:
 *
 *   fee as scheduled  x  rate (fee -> base)      =  amount owed, in base
 *   amount owed       x  rate (base -> display)  =  converted amount shown
 *
 * Everything here is a live calculation: it reads the rates on record now
 * and is right for a fee that hasn't been paid. Once a payment is
 * recorded, its figures are stored with a snapshot of the rates used
 * (conversion.service.ts) and this file is not consulted for it again.
 */

export type FeeCategory = "national" | "international";

export interface ScheduledFee {
  /** The fee schedule entry it came from; null when the institution has none and the platform default applied. */
  feeConfigId: string | null;
  name: string;
  currency: string;
  amount: number;
}

/**
 * The application fee an institution charges today: its active
 * "application" entry for the category whose period contains today (the
 * most recently started, if several do). An institution with none falls
 * back to the suggested amount on the platform's APP fee type, which is
 * in the base currency.
 */
export async function scheduledApplicationFee(db: Executor, institutionId: string, category: FeeCategory = "national"): Promise<ScheduledFee> {
  const today = new Date().toISOString().slice(0, 10);
  const [fee] = await db
    .select({ id: feeConfigs.id, name: feeConfigs.name, currency: feeConfigs.currency, amount: feeConfigs.amount })
    .from(feeConfigs)
    .where(
      and(
        eq(feeConfigs.institutionId, institutionId),
        eq(feeConfigs.type, "application"),
        eq(feeConfigs.category, category),
        eq(feeConfigs.status, "ACTIVE"),
        // In effect today: started, and not past its end date if it has one.
        lte(feeConfigs.effectiveDate, today),
        or(isNull(feeConfigs.effectiveTo), gte(feeConfigs.effectiveTo, today))
      )
    )
    .orderBy(desc(feeConfigs.effectiveDate))
    .limit(1);
  if (fee) return { feeConfigId: fee.id, name: fee.name, currency: fee.currency, amount: fee.amount };
  const [type] = await db.select({ attrs: parameters.attrs }).from(parameters).where(eq(parameters.id, "fee-types:APP")).limit(1);
  return { feeConfigId: null, name: "Application fee", currency: BASE_CURRENCY, amount: Number(type?.attrs?.defaultAmount ?? 0) };
}

/**
 * The web fee that applies to an institution, in the base currency: its
 * own if it has been given one, otherwise the platform web fee from
 * Payment configuration.
 */
export async function webFeeFor(db: Executor, institutionWebFee: number | null): Promise<number> {
  if (institutionWebFee !== null) return institutionWebFee;
  return (await getSettings("payment", db)).defaultWebFee;
}

export interface PricedFee {
  priced: true;
  fee: ScheduledFee;
  /** The fee's conversion into the base currency. Its `derivation` is null when the fee was scheduled in the base currency. */
  feeRate: RateQuote;
  /** The base currency the three amounts are in. */
  currency: string;
  applicationFee: number;
  webFee: number;
  amount: number;
}

export interface UnpricedFee {
  priced: false;
  fee: ScheduledFee;
  currency: string;
  webFee: number;
  /** Why no amount could be worked out, for the applicant to read. */
  reason: string;
}

export type FeeAssessment = PricedFee | UnpricedFee;

/**
 * What applying to an institution costs right now, in the base currency.
 *
 * `webFee` is the institution's own web fee, or null to use the
 * platform's. A fee scheduled in a currency that has no exchange rate at
 * the moment can't be priced; that is reported, not guessed at.
 */
export async function assessFee(db: Executor, institution: { id: string; webFee: number | null }, at: Date = new Date()): Promise<FeeAssessment> {
  const [fee, webFee] = [await scheduledApplicationFee(db, institution.id), await webFeeFor(db, institution.webFee)];
  const feeRate = await quoteRate(db, fee.currency, BASE_CURRENCY, at);
  if (!feeRate) {
    return { priced: false, fee, currency: BASE_CURRENCY, webFee, reason: `This institution sets its fee in ${fee.currency}, and there is no exchange rate for ${fee.currency} at the moment. The amount will appear once Cheeta administration has added one.` };
  }
  const decimals = (await decimalsOf(db, [BASE_CURRENCY])).get(BASE_CURRENCY)!;
  const applicationFee = feeRate.derivation ? convertAt(fee.amount, feeRate.rate, decimals) : fee.amount;
  return { priced: true, fee, feeRate, currency: BASE_CURRENCY, applicationFee, webFee, amount: applicationFee + webFee };
}

/** Base-currency amounts as they look in a display currency, at a quote (live) or at a stored rate (historical). */
export function inDisplayCurrency(rate: { toCurrency: string; rate: number; source: string; effectiveFrom: Date }, decimals: number, amounts: { applicationFee: number; webFee: number; total: number }, total?: number): DisplayAmounts {
  return {
    currency: rate.toCurrency,
    rate: rate.rate,
    basePerUnit: roundTo(1 / rate.rate, 6),
    source: rate.source,
    rateEffectiveFrom: rate.effectiveFrom.toISOString(),
    applicationFee: convertAt(amounts.applicationFee, rate.rate, decimals),
    webFee: convertAt(amounts.webFee, rate.rate, decimals),
    // A stored total is used as it was stored; otherwise the total is converted as one figure, so it is not the sum of two rounded parts.
    total: total ?? convertAt(amounts.total, rate.rate, decimals),
  };
}
