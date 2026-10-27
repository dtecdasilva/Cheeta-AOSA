import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { dashboardCounts } from "@/server/modules/applications/institution.service";

/** GET: the dashboard figures for the caller's institution (and the sidebar's "to review" badge). */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await dashboardCounts(user) }));
