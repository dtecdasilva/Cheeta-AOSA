import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDeliberationList } from "@/server/modules/deliberation/deliberation.service";

/**
 * GET: the Deliberation List — acknowledged applicants awaiting a
 * decision, with their program choices. Available to every institution,
 * with or without a deliberation subscription.
 */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await getDeliberationList(user) }));
