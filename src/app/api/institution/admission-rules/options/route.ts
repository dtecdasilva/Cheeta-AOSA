import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { ruleBuilderOptions } from "@/server/modules/admission/rules.service";

/** What a rule can test (built from the platform's configuration) and the institution's faculties, departments and programs. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await ruleBuilderOptions(user) }));
