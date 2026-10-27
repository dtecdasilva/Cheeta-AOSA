import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { evaluateRule } from "@/server/modules/admission/rules.service";

/** POST { applicationId, version? }: tests the rule against a submitted application, program by program, with reasons. */
export const POST = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) => ok({ data: await evaluateRule(user, params.id, await readJson(req)) }));
