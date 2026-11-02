import { handler } from "@/server/http/handler";
import { readJson } from "@/server/http/validate";
import { created, ok } from "@/server/http/respond";
import { adminOverview, recordPayout } from "@/server/modules/payouts/payouts.service";

/** GET: what Cheeta owes each institution, and the latest payouts. POST: record a payout to an institution. */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async () => ok({ data: await adminOverview() }));
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => created({ data: await recordPayout(user, await readJson(req)) }));
