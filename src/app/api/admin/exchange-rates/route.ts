import { z } from "zod";
import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { parseQuery, readJson } from "@/server/http/validate";
import { currentRates, rateHistory, setRate } from "@/server/modules/reference/exchangeRates.service";

/** GET: current rates and recent changes (?code= to narrow). POST { code, xafPerUnit, source }: set a rate. */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const { code } = parseQuery(req, z.object({ code: z.string().length(3).optional() }));
  const [current, history] = await Promise.all([currentRates(), rateHistory(code)]);
  return ok({ data: current, history });
});
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => created({ data: await setRate(await readJson(req), user.id) }));
