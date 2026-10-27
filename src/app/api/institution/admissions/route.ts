import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listForInstitution } from "@/server/modules/deliberation/admissions.service";

/** The institution's Admission List, made by published deliberation runs: ?status=OFFERED|ACCEPTED|REJECTED, ?runId=, ?programId=, ?q=. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => NextResponse.json(await listForInstitution(user, req)));
