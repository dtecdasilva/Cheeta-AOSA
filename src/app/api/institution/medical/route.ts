import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { listRecords } from "@/server/modules/medical/medical.service";

/** Medical records, one per requirement per admitted student, with each student's clearance. ?accountId= for one student. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => NextResponse.json(await listRecords(user, req)));
