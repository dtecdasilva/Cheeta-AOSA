import { and, asc, eq } from "drizzle-orm";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDb } from "@/server/db/client";
import { currencies } from "@/server/db/schema";
import { currentRates } from "@/server/modules/reference/exchangeRates.service";

/** Currencies applicants can view fees in, with their current rate against XAF. */
export const GET = handler({ auth: "public" }, async () => {
  const [rows, rates] = await Promise.all([
    getDb().select().from(currencies).where(and(eq(currencies.status, "ACTIVE"), eq(currencies.displayToApplicants, true))).orderBy(asc(currencies.code)),
    currentRates(),
  ]);
  return ok({
    data: rows.map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      decimalDigits: c.decimalDigits,
      symbolPosition: c.symbolPosition,
      xafPerUnit: c.code === "XAF" ? 1 : rates.find((r) => r.code === c.code)?.xafPerUnit ?? null,
    })),
  });
});
