import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseQuery } from "@/server/http/validate";
import { NotFoundError } from "@/server/http/errors";
import { getDb } from "@/server/db/client";
import { convertWith, quoteRate } from "@/server/modules/reference/conversion.service";

const code = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Give a three-letter currency code.");

/**
 * Today's exchange rate between two currencies, and optionally an amount
 * converted at it:
 *
 *   GET ?from=USD&to=XAF            the rate
 *   GET ?from=USD&to=XAF&amount=50  the rate and the converted amount
 *
 * The rate comes from the rates on record: the pair's own, or that rate
 * read the other way round, or crossed through the base currency
 * (`derivation` says which). This is a live figure for showing an
 * estimate. It is not what a recorded payment was converted at; that is
 * stored with the payment.
 */
export const GET = handler({ auth: "authenticated" }, async ({ req }) => {
  const q = parseQuery(req, z.object({ from: code, to: code, amount: z.coerce.number({ error: "Give the amount as a number." }).min(0).max(1_000_000_000_000).optional() }));
  const db = getDb();
  const quote = await quoteRate(db, q.from, q.to);
  if (!quote) throw new NotFoundError(`An exchange rate between ${q.from} and ${q.to}`);
  return ok({
    data: {
      fromCurrency: quote.fromCurrency,
      toCurrency: quote.toCurrency,
      rate: quote.rate,
      derivation: quote.derivation ?? "same",
      source: quote.source,
      effectiveFrom: quote.effectiveFrom?.toISOString() ?? null,
      ...(q.amount !== undefined ? { amount: q.amount, converted: await convertWith(db, q.amount, quote) } : {}),
    },
  });
});
