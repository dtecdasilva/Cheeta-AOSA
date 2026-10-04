import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { markNotification } from "@/server/notifications/notifications.service";

const body = z.object({ read: z.boolean().optional(), archived: z.boolean().optional() });

export const PATCH = handler<{ id: string }>({ auth: "authenticated" }, async ({ req, params, user }) => ok({ data: await markNotification(user, params.id, await parseBody(req, body)) }));
