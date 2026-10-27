import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listRows } from "@/server/modules/matriculation/matriculation.service";

/** Every admitted student with their admission, tuition and medical conditions and matriculation status. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => ok({ data: await listRows(user, req.nextUrl.searchParams.get("institutionId")) }));
