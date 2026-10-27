import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { flushDeliveries } from "@/server/notifications/engine";

/** POST: sends what is waiting now, instead of on the next request or scheduled run. */
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async () => ok({ data: await flushDeliveries(100) }));
