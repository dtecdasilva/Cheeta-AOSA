import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listDeliveries } from "@/server/modules/notifications/deliveries.service";

/** Every email, SMS and in-app message: ?status=, ?channel=, ?event=, ?recipientUserId=, ?notificationId=, ?q=. */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => NextResponse.json(await listDeliveries(req)));
