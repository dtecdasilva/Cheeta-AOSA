import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getAccountForAdmin } from "@/server/modules/tuition/tuition.service";

export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok({ data: await getAccountForAdmin(params.id) }));
