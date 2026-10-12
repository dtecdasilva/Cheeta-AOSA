import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { findFeeByBankCode } from "@/server/modules/applications/institution.service";

/** ?code=BK26-A7KQ-M9TX: the paid applicant at the caller's institution with that bank code, or null. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) =>
  ok({ data: await findFeeByBankCode(user, req.nextUrl.searchParams.get("code")?.slice(0, 40) ?? "") })
);
