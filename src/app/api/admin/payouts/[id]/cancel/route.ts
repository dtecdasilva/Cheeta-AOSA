import { handler } from "@/server/http/handler";
import { readJson } from "@/server/http/validate";
import { ok } from "@/server/http/respond";
import { cancelPayout } from "@/server/modules/payouts/payouts.service";

/** POST { reason }: cancel a payout recorded in error. It stays on record. */
export const POST = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, user, params }) => ok({ data: await cancelPayout(user, params.id, await readJson(req)) }));
