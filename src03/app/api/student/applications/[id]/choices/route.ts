import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { setProgramChoices } from "@/server/modules/applications/student.service";

/** PUT { choices: [{ programId, rank }] } replaces the ranked program choices. */
export const PUT = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => ok({ data: await setProgramChoices(user, params.id, await readJson(req)) }));
