import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getExamConfigurationData } from "@/server/modules/student/examinations.service";

/**
 * GET: the examination configuration the Examinations and Results forms
 * are built from — every qualification with its subjects, grades or
 * scoring, pass criteria and sitting limits, and the result types — as
 * the administrators have set it under Examination parameters.
 */
export const GET = handler({ auth: "authenticated" }, async () => ok(await getExamConfigurationData()));
