import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listReports } from "@/server/reports/reports.service";

/** The reports the signed-in staff member can run, with each one's filters and sort keys. */
export const GET = handler({ auth: ["AOSA_ADMIN", "INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: listReports(user) }));
