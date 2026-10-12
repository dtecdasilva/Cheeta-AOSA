import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listForInstitution } from "@/server/modules/applications/institution.service";

/**
 * Applications to the caller's institution: ?status=, ?q= (applicant), ?reference= (Application ID, reference or bank code),
 * ?from=, ?to= (date submitted). `counts` is how many are in each status, whatever the filters.
 * Applicants stay masked until Cheeta administration approves their fee.
 */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => NextResponse.json(await listForInstitution(user, req)));
