import "server-only";
import { eq, inArray } from "drizzle-orm";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { convertAt, roundRate } from "@/lib/currency/money";
import type { Executor } from "@/server/db/client";
import { currencies, exchangeRateSnapshots } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { rateAt } from "./exchangeRates.service";

/**
 * Converting money between currencies, and keeping a record of the rate a
 * transaction was converted at.
 *
 * Two different things happen with a rate, and they must not be confused:
 *
 * - A QUOTE (`quoteRate`) is today's answer. It is read from the rates on
 *   record every time it is asked for, so it follows the latest rate. Use
 *   it for anything not yet paid.
 * - A SNAPSHOT (`takeSnapshot`) is the answer that was given when a
 *   transaction happened. It is copied out of the quote into its own row
 *   and never looked up again. Use it, and only it, for anything that
 *   has been paid or recorded.
 *
 * Nothing in this file updates a snapshot, and nothing reads the live
 * rates on behalf of an existing transaction.
 */

/** How a rate was arrived at from the rates on record. */
export type Derivation = "direct" | "inverse" | "cross";

export interface RateQuote {
  fromCurrency: string;
  toCurrency: string;
  /** Units of `toCurrency` per one unit of `fromCurrency`. */
  rate: number;
  /** Null when the two currencies are the same: there is nothing to convert, and nothing to record. */
  derivation: Derivation | null;
  /** The rate on record it came from (the first of two, for a cross). */
  rateId: string | null;
  viaRateId: string | null;
  source: string;
  /** When the rate on record started to apply; for a cross, the later of the two. */
  effectiveFrom: Date | null;
}

/** One leg: a pair's rate as it stands on record, or read the other way round. */
async function leg(db: Executor, from: string, to: string, at: Date) {
  const direct = await rateAt(db, from, to, at);
  if (direct) return { rate: direct.rate, derivation: "direct" as const, row: direct };
  const inverse = await rateAt(db, to, from, at);
  if (inverse && inverse.rate > 0) return { rate: 1 / inverse.rate, derivation: "inverse" as const, row: inverse };
  return null;
}

/**
 * The rate between two currencies at a moment (now, by default), or null
 * if the rates on record can't give one.
 *
 * It uses the pair's own rate if there is one; otherwise that rate read
 * the other way round; otherwise it crosses through the base currency
 * (USD to EUR as USD to XAF, then XAF to EUR).
 */
export async function quoteRate(db: Executor, from: string, to: string, at: Date = new Date()): Promise<RateQuote | null> {
  if (from === to) return { fromCurrency: from, toCurrency: to, rate: 1, derivation: null, rateId: null, viaRateId: null, source: "", effectiveFrom: null };

  const single = await leg(db, from, to, at);
  if (single) {
    return { fromCurrency: from, toCurrency: to, rate: roundRate(single.rate), derivation: single.derivation, rateId: single.row.id, viaRateId: null, source: single.row.source, effectiveFrom: single.row.effectiveFrom };
  }

  if (from === BASE_CURRENCY || to === BASE_CURRENCY) return null;
  const [first, second] = [await leg(db, from, BASE_CURRENCY, at), await leg(db, BASE_CURRENCY, to, at)];
  if (!first || !second) return null;
  return {
    fromCurrency: from,
    toCurrency: to,
    rate: roundRate(first.rate * second.rate),
    derivation: "cross",
    rateId: first.row.id,
    viaRateId: second.row.id,
    source: first.row.source === second.row.source ? first.row.source : `${first.row.source}; ${second.row.source}`,
    effectiveFrom: first.row.effectiveFrom > second.row.effectiveFrom ? first.row.effectiveFrom : second.row.effectiveFrom,
  };
}

/** Decimal places each currency is counted in; 2 for one that isn't on record. */
export async function decimalsOf(db: Executor, codes: string[]): Promise<Map<string, number>> {
  const wanted = [...new Set(codes)];
  if (!wanted.length) return new Map();
  const rows = await db.select({ code: currencies.code, decimalDigits: currencies.decimalDigits }).from(currencies).where(inArray(currencies.code, wanted));
  return new Map(wanted.map((code) => [code, rows.find((r) => r.code === code)?.decimalDigits ?? 2]));
}

/** `amount` converted at a quote, rounded to the target currency's decimal places. */
export async function convertWith(db: Executor, amount: number, quote: RateQuote): Promise<number> {
  if (!quote.derivation) return amount;
  const decimals = (await decimalsOf(db, [quote.toCurrency])).get(quote.toCurrency)!;
  return convertAt(amount, quote.rate, decimals);
}

export type RateSnapshot = typeof exchangeRateSnapshots.$inferSelect;

/**
 * Records the conversion of `amount` at a quote, for a transaction that is
 * being made now, and returns the stored snapshot (or null when the two
 * currencies are the same: nothing was converted, so there is nothing to
 * keep). Call it inside the transaction that writes the record it belongs
 * to.
 */
export async function takeSnapshot(tx: Executor, quote: RateQuote, amount: number): Promise<RateSnapshot | null> {
  if (!quote.derivation || !quote.effectiveFrom) return null;
  const [row] = await tx
    .insert(exchangeRateSnapshots)
    .values({
      id: newId("fxs"),
      fromCurrency: quote.fromCurrency,
      toCurrency: quote.toCurrency,
      rate: quote.rate,
      fromAmount: amount,
      toAmount: await convertWith(tx, amount, quote),
      derivation: quote.derivation,
      rateId: quote.rateId,
      viaRateId: quote.viaRateId,
      source: quote.source,
      rateEffectiveFrom: quote.effectiveFrom,
    })
    .returning();
  return row;
}

/** Stored snapshots by id. */
export async function loadSnapshots(db: Executor, ids: (string | null | undefined)[]): Promise<Map<string, RateSnapshot>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map();
  const rows = wanted.length === 1 ? await db.select().from(exchangeRateSnapshots).where(eq(exchangeRateSnapshots.id, wanted[0])) : await db.select().from(exchangeRateSnapshots).where(inArray(exchangeRateSnapshots.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

/** A snapshot as the APIs show it. */
export function presentSnapshot(s: RateSnapshot) {
  return {
    fromCurrency: s.fromCurrency,
    toCurrency: s.toCurrency,
    rate: s.rate,
    fromAmount: s.fromAmount,
    toAmount: s.toAmount,
    derivation: s.derivation,
    source: s.source,
    rateEffectiveFrom: s.rateEffectiveFrom.toISOString(),
    takenAt: s.takenAt.toISOString(),
  };
}

export type SnapshotView = ReturnType<typeof presentSnapshot>;
