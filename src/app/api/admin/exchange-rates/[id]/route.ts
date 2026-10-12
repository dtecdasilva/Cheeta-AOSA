import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { setRateStatus } from "@/server/modules/reference/exchangeRates.service";

/**
 * PATCH { status }: withdraw a rate entered in error (INACTIVE) or restore
 * it. Nothing else about a recorded rate can be changed, and there is no
 * DELETE: rates are history.
 */
export const PATCH = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params }) => ok({ data: await setRateStatus(params.id, await readJson(req)) }));
