import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createRequirement, listRequirements } from "@/server/modules/tuition/tuition.service";

/** GET: what the institution charges in tuition. POST (institution administrators): a new requirement. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await listRequirements(user) }));
export const POST = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => created({ data: await createRequirement(user, await readJson(req)) }));
