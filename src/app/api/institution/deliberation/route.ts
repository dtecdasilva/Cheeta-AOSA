import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDeliberationOverview } from "@/server/modules/deliberation/deliberation.service";

/**
 * GET: where the institution stands on deliberation — the prices, its
 * subscription (if any), whether it may deliberate now, how many names
 * are on its list and what it has been charged.
 */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await getDeliberationOverview(user) }));
