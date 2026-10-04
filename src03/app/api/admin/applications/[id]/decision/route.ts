import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { decide } from "@/server/modules/applications/institution.service";
import { getApplicationForAdmin } from "@/server/modules/applications/admin.service";

/** AOSA acting on an application, recorded with actor "admin". Same body as the institution's decision endpoint. */
export const POST = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => {
  await decide(user, params.id, await readJson(req), "admin");
  return ok({ data: await getApplicationForAdmin(user, params.id) });
});
