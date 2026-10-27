import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { provisionalAdmit, provisionalCandidates } from "@/server/modules/deliberation/provisional.service";
import { getForInstitution } from "@/server/modules/deliberation/admissions.service";

const STAFF = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] as const;

/** Who the latest published deliberation run didn't admit and can still be offered a provisional place, with places left per choice. */
export const GET = handler({ auth: [...STAFF] }, async ({ user }) => ok({ data: await provisionalCandidates(user) }));

/** Makes a provisional offer: { resultId, programId, conditions, deadline (YYYY-MM-DD) }. */
export const POST = handler({ auth: [...STAFF] }, async ({ req, user }) => {
  const { id } = await provisionalAdmit(user, await readJson(req));
  return created({ data: await getForInstitution(user, id) });
});
