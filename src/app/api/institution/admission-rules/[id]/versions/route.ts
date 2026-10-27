import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { addVersion } from "@/server/modules/admission/rules.service";

/** POST { condition, scope?, notes? }: what the rule requires from now on, as a new version. */
export const POST = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) => created({ data: await addVersion(user, params.id, await readJson(req)) }));
