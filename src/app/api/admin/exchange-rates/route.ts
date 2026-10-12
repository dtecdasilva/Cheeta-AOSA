import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createRate, currentRates, listRates } from "@/server/modules/reference/exchangeRates.service";

/**
 * GET   ?from=&to=&status=&at=&limit=
 *       `data`     the rate applying now to each currency against the base currency;
 *       `history`  every rate on record that matches the filters, newest period first.
 * POST  { fromCurrency, toCurrency?, rate, source, effectiveFrom?, effectiveTo? }
 *       adds a rate. Existing rates are never changed by this, apart from
 *       the date their period ends.
 */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const [data, history] = await Promise.all([currentRates(), listRates(Object.fromEntries(req.nextUrl.searchParams))]);
  return ok({ data, history });
});

export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => created({ data: await createRate(await readJson(req), user.id) }));
