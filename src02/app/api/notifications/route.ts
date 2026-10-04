import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { pagination, parseQuery } from "@/server/http/validate";
import { listNotifications } from "@/server/notifications/notifications.service";

const query = pagination.extend({ archived: z.enum(["true", "false"]).default("false").transform((v) => v === "true") });

export const GET = handler({ auth: "authenticated" }, async ({ req, user }) => {
  const q = parseQuery(req, query);
  return ok(await listNotifications(user, q));
});
