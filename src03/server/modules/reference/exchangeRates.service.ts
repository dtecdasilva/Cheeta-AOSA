import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { getDb } from "@/server/db/client";
import { currencies, exchangeRates } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ValidationError } from "@/server/http/errors";
import { requiredText } from "@/server/http/validate";

/**
 * Exchange rates against XAF. Each change is a new row; a currency's
 * current rate is its latest row.
 */

export async function currentRates() {
  const db = getDb();
  const rows = await db.execute<{ currency_code: string; xaf_per_unit: string; source: string; as_of: Date; created_by: string | null }>(sql`
    select distinct on (currency_code) currency_code, xaf_per_unit, source, as_of, created_by
    from ${exchangeRates}
    order by currency_code, as_of desc
  `);
  return rows.rows.map((r) => ({
    code: r.currency_code,
    xafPerUnit: Number(r.xaf_per_unit),
    source: r.source,
    asOf: new Date(r.as_of).toISOString(),
    updatedBy: r.created_by,
  }));
}

export async function rateHistory(code?: string, limit = 100) {
  const db = getDb();
  const rows = await db
    .select()
    .from(exchangeRates)
    .where(code ? eq(exchangeRates.currencyCode, code) : undefined)
    .orderBy(desc(exchangeRates.asOf))
    .limit(Math.min(limit, 500));
  return rows;
}

const setRateSchema = z.object({
  code: z.string().trim().toUpperCase().length(3),
  xafPerUnit: z.number().positive("Enter a rate above 0.").max(1_000_000),
  source: requiredText(120),
});

export async function setRate(input: unknown, actorId: string) {
  const v = setRateSchema.parse(input);
  if (v.code === BASE_CURRENCY) throw new ValidationError({ code: `${BASE_CURRENCY} is the base currency; its rate is always 1.` });
  const db = getDb();
  const [currency] = await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.code, v.code)).limit(1);
  if (!currency) throw new ValidationError({ code: "Add this currency before setting its rate." });

  return db.transaction(async (tx) => {
    const [previous] = await tx.select().from(exchangeRates).where(eq(exchangeRates.currencyCode, v.code)).orderBy(desc(exchangeRates.asOf)).limit(1);
    const [row] = await tx.insert(exchangeRates).values({ id: newId("rate"), currencyCode: v.code, xafPerUnit: v.xafPerUnit, source: v.source, createdBy: actorId }).returning();
    await audit(tx, {
      action: "update",
      entityType: "exchange-rate",
      entityId: v.code,
      before: previous ? { xafPerUnit: previous.xafPerUnit, source: previous.source } : null,
      after: { xafPerUnit: row.xafPerUnit, source: row.source },
    });
    return { code: row.currencyCode, xafPerUnit: row.xafPerUnit, source: row.source, asOf: row.asOf.toISOString(), previous: previous?.xafPerUnit ?? null };
  });
}
