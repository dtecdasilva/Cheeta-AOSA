import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { findByBankCode } from "@/server/modules/tuition/tuition.service";

/** ?code=BK26-T...: the student a verified tuition payment belongs to. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => ok({ data: await findByBankCode(user, req.nextUrl.searchParams.get("code") ?? "") }));
