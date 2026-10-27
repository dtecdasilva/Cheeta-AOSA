import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { studentRecordForAdmin } from "@/server/modules/admin/adminData.service";

/** One student's full record for Cheeta administration: demographics, section progress, institutions, fees. */
export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok({ data: await studentRecordForAdmin(params.id) }));
