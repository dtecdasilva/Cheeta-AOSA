import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getDeliberationFees, grantSubscription, listSubscriptions } from "@/server/modules/deliberation/deliberation.service";

/**
 * GET   every deliberation subscription and request, newest first, with
 *       the per-name charges raised on each, and the current prices.
 * POST  { institutionId, note? }: start a subscription for an institution
 *       directly, at the current prices.
 */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async () => ok({ data: await listSubscriptions(), fees: await getDeliberationFees() }));

export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => created({ data: await grantSubscription(user, await readJson(req)) }));
