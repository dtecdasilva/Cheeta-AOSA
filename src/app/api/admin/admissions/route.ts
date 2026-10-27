import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listAll } from "@/server/modules/deliberation/admissions.service";

/** Every institution's admissions: ?institutionId=, ?status=, ?runId=, ?programId=, ?q=. */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => NextResponse.json(await listAll(req)));
