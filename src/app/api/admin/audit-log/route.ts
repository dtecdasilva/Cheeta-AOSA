import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listAudit } from "@/server/audit/audit.service";

/**
 * The whole audit trail: ?category=, ?action=, ?entityType=, ?entityId=,
 * ?actorUserId=, ?institutionId=, ?q=, ?from=, ?to=, ?dir=, paged, or
 * ?format=csv. Entries can't be changed or deleted.
 */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => {
  const out = await listAudit(user, req);
  if ("csv" in out) return new NextResponse(out.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "private, no-store" } });
  return NextResponse.json(out);
});
