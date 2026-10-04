import { handler } from "@/server/http/handler";
import { paged } from "@/server/http/respond";
import { listAllApplications } from "@/server/modules/applications/admin.service";

export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const r = await listAllApplications(req);
  return paged(r.data, r.meta);
});
