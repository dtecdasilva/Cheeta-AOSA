import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { statusCounts } from "@/server/modules/applications/institution.service";

export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await statusCounts(user) }));
