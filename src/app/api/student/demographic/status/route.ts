import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDemographicCompletion } from "@/server/modules/student/profile.service";

/**
 * GET: how complete the applicant's demographic section is — NOT_STARTED,
 * IN_PROGRESS or COMPLETE — with the count of required fields done and
 * the ones still missing or invalid (src/lib/demographic/completion.ts).
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok(await getDemographicCompletion(user)));
