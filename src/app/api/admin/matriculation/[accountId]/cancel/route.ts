import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { cancelMatriculation } from "@/server/modules/matriculation/matriculation.service";

/** POST { reason }: cancels a matriculation confirmed in error. The record and its code are kept, marked cancelled. */
export const POST = handler<{ accountId: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await cancelMatriculation(user, params.accountId, await readJson(req)) }));
