import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getApplicationForAdmin } from "@/server/modules/applications/admin.service";

export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params, user }) => ok({ data: await getApplicationForAdmin(user, params.id) }));
