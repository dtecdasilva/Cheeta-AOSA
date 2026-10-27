import { handler } from "@/server/http/handler";
import { paged } from "@/server/http/respond";
import { listApplicationDataset } from "@/server/modules/admin/adminData.service";

/** GET: every application with its status history and latest fee payment, paged — what the dashboard, application and progression screens analyse. */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const r = await listApplicationDataset(req);
  return paged(r.data, r.meta);
});
