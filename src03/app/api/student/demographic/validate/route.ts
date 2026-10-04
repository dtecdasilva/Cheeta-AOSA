import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { validateDemographic } from "@/server/modules/student/profile.service";

/**
 * POST { ...fields, mode? }: checks a change against the same rules as
 * saving it, on top of what is already stored, and writes nothing.
 * Always 200 for a well-formed request: `valid` says whether it would be
 * accepted, `fieldErrors` says why not, and `completion` is the status
 * the section would have afterwards.
 */
export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => ok(await validateDemographic(user, await readJson(req))));
