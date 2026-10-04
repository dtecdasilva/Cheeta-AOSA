import { handler } from "@/server/http/handler";
import { paged } from "@/server/http/respond";
import { listFeePayments } from "@/server/modules/applications/admin.service";

/** The approval desk: ?approval=AWAITING|APPROVED|REJECTED, ?institutionId=, ?q= */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const r = await listFeePayments(req);
  return paged(r.data, r.meta);
});
