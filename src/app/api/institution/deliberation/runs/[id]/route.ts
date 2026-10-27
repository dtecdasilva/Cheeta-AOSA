import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getRun } from "@/server/modules/deliberation/engine.service";

/** One run: its report and every applicant's result with the reasons. */
export const GET = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ params, user }) => ok({ data: await getRun(user, params.id) }));
