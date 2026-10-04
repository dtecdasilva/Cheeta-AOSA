import { handler } from "@/server/http/handler";
import { paged } from "@/server/http/respond";
import { listAudit } from "@/server/modules/applications/admin.service";

/** Filter by ?entityType=, ?entityId=, ?actorUserId=, ?institutionId=, ?action=, ?from=, ?to= */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const r = await listAudit(req);
  return paged(r.data, r.meta);
});
