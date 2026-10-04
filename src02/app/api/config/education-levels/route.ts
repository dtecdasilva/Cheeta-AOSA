import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listEducationLevels } from "@/server/modules/student/profile.service";

/** School types and qualifications for the Education Information form, from the database. */
export const GET = handler({ auth: "authenticated" }, async () => ok({ levels: await listEducationLevels() }));
