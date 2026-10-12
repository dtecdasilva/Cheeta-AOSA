import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { settleCharges } from "@/server/modules/deliberation/deliberation.service";

/** POST: record that the institution has paid the per-name charges raised so far on this subscription. */
export const POST = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params, user }) => ok({ data: await settleCharges(user, params.id) }));
