import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { sendPasswordReset } from "@/server/modules/accounts/accounts.service";

export const POST = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok(await sendPasswordReset(params.id)));
