import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createRequirement, listRequirements } from "@/server/modules/medical/medical.service";

/** GET: what the institution asks for medically (or the platform defaults it uses). POST (institution administrators): a requirement. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok(await listRequirements(user)));
export const POST = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => created({ data: await createRequirement(user, await readJson(req)) }));
