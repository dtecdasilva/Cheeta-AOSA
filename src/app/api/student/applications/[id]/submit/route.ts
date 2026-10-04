import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { submitApplication } from "@/server/modules/applications/student.service";

/** POST { declaration: true }: submit (or resubmit). Refused with the failing checklist items if not ready. */
export const POST = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => ok({ data: await submitApplication(user, params.id, await readJson(req)) }));
