import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { publishRun } from "@/server/modules/deliberation/engine.service";

/** Makes the offers the run proposed. Latest run only, once. */
export const POST = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ params, user }) => ok({ data: await publishRun(user, params.id) }));
