import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { updateRequirement } from "@/server/modules/tuition/tuition.service";

/** Applies to students who take up an offer from now on; open accounts keep their amount. */
export const PATCH = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) => ok({ data: await updateRequirement(user, params.id, await readJson(req)) }));
