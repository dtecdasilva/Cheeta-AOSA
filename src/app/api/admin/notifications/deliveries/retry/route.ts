import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";
import { retryDeliveries } from "@/server/notifications/engine";

/** POST { ids }: puts failed messages back in the queue. Ones that carried a login code or link are left: the person asks again. */
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => {
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string().max(100)).min(1).max(200) }));
  const queued = await retryDeliveries(ids);
  await audit(getDb(), { action: "retry", entityType: "notification-delivery", entityId: ids.join(",").slice(0, 200), actorUserId: user.id, meta: { requested: ids.length, queued } });
  return ok({ data: { queued } });
});
