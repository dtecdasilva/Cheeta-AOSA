import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listAccountsForAdmin } from "@/server/modules/tuition/tuition.service";

/** Every tuition account: ?institutionId=, ?verification=AWAITING|QUERIED|..., ?q= (name, Application ID, payment reference, bank code). */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => NextResponse.json(await listAccountsForAdmin(req)));
