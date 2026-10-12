import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listFeesForInstitution } from "@/server/modules/applications/institution.service";

/**
 * Application fees at the caller's institution: who has paid (approved by
 * Cheeta administration, identified by bank code, own fee only) and who is
 * still awaiting payment approval (masked name, nothing else).
 * ?state=AWAITING|PAID, ?q=
 */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => NextResponse.json(await listFeesForInstitution(user, req)));
