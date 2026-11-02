import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { myStatement } from "@/server/modules/payouts/payouts.service";

/** The caller's institution: what Cheeta owes it, what it has earned and every payout received. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await myStatement(user) }));
