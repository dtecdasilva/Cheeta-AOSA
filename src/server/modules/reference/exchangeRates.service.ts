import "server-only";
import { and, asc, desc, eq, gt, isNull, lte, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { getDb, type Executor } from "@/server/db/client";
import { currencies, exchangeRates, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith, requiredText } from "@/server/http/validate";

/**
 * Exchange rates between currency pairs, each with the period it applies
 * to. History is never rewritten: adding a rate inserts a row and touches
 * no other. A rate can be switched off (INACTIVE) if it was entered in
 * error, but its figures and dates can't be edited and it can't be deleted.
 *
 * Which rate applies at a moment: of the pair's ACTIVE rates that have
 * started and not passed an end date of their own, the one that started
 * most recently. So a newer rate takes over from an older one without the
 * older row being changed, and withdrawing the newer one hands back to
 * the older one by itself.
 */

type Rate = typeof exchangeRates.$inferSelect;

export interface RateView {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  /** How many `toCurrency` equal one `fromCurrency`. */
  rate: number;
  source: string;
  effectiveFrom: string;
  /** The end date given when the rate was entered, if it was given one. */
  effectiveTo: string | null;
  /** When it actually stops applying: its own end date, or the start of the next rate for the pair, whichever comes first. Null while it is open-ended. */
  appliesUntil: string | null;
  status: "ACTIVE" | "INACTIVE";
  /** Whether this is the rate applying to the pair right now. */
  current: boolean;
  createdBy: string | null;
  createdAt: string;
}

const pairOf = (from: string, to: string) => and(eq(exchangeRates.fromCurrency, from), eq(exchangeRates.toCurrency, to));

/** Rows whose period contains `at`. */
const coversMoment = (at: Date) => and(eq(exchangeRates.status, "ACTIVE"), lte(exchangeRates.effectiveFrom, at), or(isNull(exchangeRates.effectiveTo), gt(exchangeRates.effectiveTo, at)));

/** When each active rate hands over to the next one for its pair. */
function handovers(rows: Rate[]): Map<string, Date> {
  const out = new Map<string, Date>();
  const byPair = new Map<string, Rate[]>();
  for (const r of rows) {
    if (r.status !== "ACTIVE") continue;
    const key = `${r.fromCurrency}>${r.toCurrency}`;
    byPair.set(key, [...(byPair.get(key) ?? []), r]);
  }
  for (const list of byPair.values()) {
    list.sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
    list.forEach((r, i) => {
      const next = list[i + 1];
      if (next) out.set(r.id, next.effectiveFrom);
    });
  }
  return out;
}

function present(r: Rate, currentIds: Set<string>, createdBy: string | null, nextStart?: Date): RateView {
  const ends = [r.effectiveTo, nextStart].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
  return {
    id: r.id,
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rate: r.rate,
    source: r.source,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
    appliesUntil: r.status === "ACTIVE" ? (ends[0]?.toISOString() ?? null) : null,
    status: r.status as RateView["status"],
    current: currentIds.has(r.id),
    createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

/** The rate applying to a pair at a moment (now, by default), if there is one. */
export async function rateAt(db: Executor, from: string, to: string, at: Date = new Date()): Promise<Rate | undefined> {
  const [row] = await db
    .select()
    .from(exchangeRates)
    .where(and(pairOf(from, to), coversMoment(at)))
    .orderBy(desc(exchangeRates.effectiveFrom))
    .limit(1);
  return row;
}

/** The rate applying now to each pair, newest period first within a pair. */
async function currentRows(db: Executor, at: Date = new Date()): Promise<Rate[]> {
  const rows = await db.select().from(exchangeRates).where(coversMoment(at)).orderBy(asc(exchangeRates.fromCurrency), asc(exchangeRates.toCurrency), desc(exchangeRates.effectiveFrom));
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.fromCurrency}>${r.toCurrency}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Current rates against the base currency, in the shape the applicant-facing
 * currency list and the admin screens have always used: how many XAF one
 * unit of each currency is worth.
 */
export async function currentRates() {
  const db = getDb();
  const rows = (await currentRows(db)).filter((r) => r.toCurrency === BASE_CURRENCY);
  const names = await namesOf(db, rows);
  return rows.map((r) => ({
    id: r.fromCurrency,
    code: r.fromCurrency,
    xafPerUnit: r.rate,
    source: r.source,
    asOf: r.effectiveFrom.toISOString(),
    updatedBy: names.get(r.createdBy ?? "") ?? "",
  }));
}

async function namesOf(db: Executor, rows: Rate[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x))];
  if (!ids.length) return new Map();
  const found = await db.select({ id: users.id, fullName: users.fullName }).from(users);
  return new Map(found.filter((u) => ids.includes(u.id)).map((u) => [u.id, u.fullName]));
}

const listSchema = z.object({
  from: z.string().trim().toUpperCase().length(3).optional(),
  to: z.string().trim().toUpperCase().length(3).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  /** Only rates whose period contains this moment. */
  at: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

/** Every rate on record (the history), newest period first, with the current rate of each pair marked. */
export async function listRates(query: unknown): Promise<RateView[]> {
  const q = parseWith(listSchema, query);
  const db = getDb();
  const conditions: (SQL | undefined)[] = [];
  if (q.from) conditions.push(eq(exchangeRates.fromCurrency, q.from));
  if (q.to) conditions.push(eq(exchangeRates.toCurrency, q.to));
  if (q.status) conditions.push(eq(exchangeRates.status, q.status));
  if (q.at) conditions.push(coversMoment(new Date(q.at)));
  const [rows, current, everything] = await Promise.all([
    db.select().from(exchangeRates).where(and(...conditions)).orderBy(desc(exchangeRates.effectiveFrom), desc(exchangeRates.createdAt)).limit(q.limit),
    currentRows(db),
    db.select().from(exchangeRates),
  ]);
  const names = await namesOf(db, rows);
  const currentIds = new Set(current.map((r) => r.id));
  const next = handovers(everything);
  return rows.map((r) => present(r, currentIds, names.get(r.createdBy ?? "") ?? null, next.get(r.id)));
}

const currencyCode = (message: string) => z.string({ error: message }).trim().toUpperCase().regex(/^[A-Z]{3}$/, message);

const createSchema = z.object({
  fromCurrency: currencyCode("Choose the currency being priced."),
  /** Defaults to the base currency. */
  toCurrency: currencyCode("Choose the currency it is priced in.").default(BASE_CURRENCY),
  rate: z.number({ error: "Enter a rate above 0." }).positive("Enter a rate above 0.").max(1_000_000_000),
  source: requiredText(120),
  /** Defaults to now. A future date schedules the rate. */
  effectiveFrom: z.iso.datetime({ offset: true, error: "Enter a valid date and time." }).optional(),
  effectiveTo: z.iso.datetime({ offset: true, error: "Enter a valid date and time." }).nullable().optional(),
});

/** Adds a rate for a pair. It is a new row; no rate already on record is changed in any way. */
export async function createRate(input: unknown, actorId: string): Promise<RateView> {
  const v = parseWith(createSchema, input);
  if (v.fromCurrency === v.toCurrency) throw new ValidationError({ toCurrency: "Choose two different currencies." });
  const effectiveFrom = v.effectiveFrom ? new Date(v.effectiveFrom) : new Date();
  const effectiveTo = v.effectiveTo ? new Date(v.effectiveTo) : null;
  if (effectiveTo && effectiveTo <= effectiveFrom) throw new ValidationError({ effectiveTo: "The end must be after the start." });

  return getDb().transaction(async (tx) => {
    const known = await tx.select({ code: currencies.code }).from(currencies);
    const codes = new Set(known.map((c) => c.code));
    if (!codes.has(v.fromCurrency)) throw new ValidationError({ fromCurrency: "Add this currency before setting its rate." });
    if (!codes.has(v.toCurrency)) throw new ValidationError({ toCurrency: "Add this currency before setting its rate." });

    // Two active rates for a pair starting at the same instant would leave no way to say which applies.
    const [sameStart] = await tx
      .select({ id: exchangeRates.id })
      .from(exchangeRates)
      .where(and(pairOf(v.fromCurrency, v.toCurrency), eq(exchangeRates.status, "ACTIVE"), eq(exchangeRates.effectiveFrom, effectiveFrom)))
      .limit(1);
    if (sameStart) throw new ValidationError({ effectiveFrom: "A rate for this pair already starts at that moment. Choose another start, or withdraw that rate first." });

    const before = await rateAt(tx, v.fromCurrency, v.toCurrency, effectiveFrom);
    const [row] = await tx
      .insert(exchangeRates)
      .values({ id: newId("rate"), fromCurrency: v.fromCurrency, toCurrency: v.toCurrency, rate: v.rate, source: v.source, effectiveFrom, effectiveTo, createdBy: actorId })
      .returning();

    await audit(tx, {
      action: "create",
      entityType: "exchange-rate",
      entityId: row.id,
      before: before ? { id: before.id, rate: before.rate, source: before.source, effectiveFrom: before.effectiveFrom } : null,
      after: { fromCurrency: row.fromCurrency, toCurrency: row.toCurrency, rate: row.rate, source: row.source, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo },
    });
    const [current, everything] = [await rateAt(tx, row.fromCurrency, row.toCurrency), await tx.select().from(exchangeRates).where(pairOf(row.fromCurrency, row.toCurrency))];
    return present(row, new Set(current ? [current.id] : []), null, handovers(everything).get(row.id));
  });
}

const statusSchema = z.strictObject({ status: z.enum(["ACTIVE", "INACTIVE"], { error: "Choose Active or Inactive." }) }, { error: "Only a rate's status can be changed. To change the figure, add a new rate." });

/**
 * Withdraws a rate entered in error, or restores one. This is the only
 * change allowed on an existing rate: its figures and dates are history.
 */
export async function setRateStatus(id: string, input: unknown): Promise<RateView> {
  const v = parseWith(statusSchema, input);
  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select().from(exchangeRates).where(eq(exchangeRates.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Exchange rate");
    if (v.status === "ACTIVE" && existing.status !== "ACTIVE") {
      const [clash] = await tx
        .select({ id: exchangeRates.id })
        .from(exchangeRates)
        .where(and(pairOf(existing.fromCurrency, existing.toCurrency), eq(exchangeRates.status, "ACTIVE"), eq(exchangeRates.effectiveFrom, existing.effectiveFrom)))
        .limit(1);
      if (clash) throw new ValidationError({ status: "Another rate for this pair starts at the same moment. Withdraw that one first." });
    }
    const [row] = await tx.update(exchangeRates).set({ status: v.status }).where(eq(exchangeRates.id, id)).returning();
    await audit(tx, { action: "status", entityType: "exchange-rate", entityId: id, before: { status: existing.status }, after: { status: row.status } });
    const [current, everything] = [await rateAt(tx, row.fromCurrency, row.toCurrency), await tx.select().from(exchangeRates).where(pairOf(row.fromCurrency, row.toCurrency))];
    return present(row, new Set(current ? [current.id] : []), null, handovers(everything).get(row.id));
  });
}
