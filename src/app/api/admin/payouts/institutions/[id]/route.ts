import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { statement } from "@/server/modules/payouts/payouts.service";

/** One institution's statement: balance, earnings, payouts and payout accounts. */
export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok({ data: await statement(params.id) }));
