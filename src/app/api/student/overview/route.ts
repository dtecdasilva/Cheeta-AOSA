import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getMyOverview } from "@/server/modules/student/overview.service";

/** GET: where the signed-in applicant stands — the five steps, each application, fees, and what needs doing. */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ data: await getMyOverview(user) }));
