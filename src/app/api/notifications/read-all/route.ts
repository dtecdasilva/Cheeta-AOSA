import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { markAllRead } from "@/server/notifications/notifications.service";

/** POST: marks everything in the signed-in person's inbox read. */
export const POST = handler({ auth: "authenticated" }, async ({ user }) => ok({ data: await markAllRead(user) }));
