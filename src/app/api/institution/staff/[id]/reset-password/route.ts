import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { resetStaffPassword } from "@/server/modules/institutions/staff.service";

export const POST = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ params, user }) => ok(await resetStaffPassword(user, params.id)));
