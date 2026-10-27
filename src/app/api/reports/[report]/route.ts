import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { runReport } from "@/server/reports/reports.service";

/**
 * One report: ?q=, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD, ?sort=, ?dir=asc|desc,
 * any of the report's filters, ?page=, ?pageSize= (up to 5000),
 * ?format=csv. Institution staff get their own institution's rows only.
 */
export const GET = handler<{ report: string }>({ auth: ["AOSA_ADMIN", "INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) => {
  const out = await runReport(user, params.report, req);
  if ("csv" in out) {
    return new NextResponse(out.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json(out);
});
