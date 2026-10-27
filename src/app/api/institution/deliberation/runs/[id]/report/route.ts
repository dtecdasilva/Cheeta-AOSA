import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { runCsv } from "@/server/modules/deliberation/engine.service";

/** The run's results as a CSV file. */
export const GET = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ params, user }) => {
  const csv = await runCsv(user, params.id);
  return new NextResponse(csv.body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${csv.filename}"` } });
});
