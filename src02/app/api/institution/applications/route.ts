import { handler } from "@/server/http/handler";
import { paged } from "@/server/http/respond";
import { listForInstitution } from "@/server/modules/applications/institution.service";

/** Applications to the caller's institution. Applicants stay masked until AOSA approves their fee. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => {
  const r = await listForInstitution(user, req);
  return paged(r.data, r.meta);
});
