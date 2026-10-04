import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getForInstitution } from "@/server/modules/applications/institution.service";

export const GET = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ params, user }) => ok({ data: await getForInstitution(user, params.id) }));
