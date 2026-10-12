import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { INSTITUTION_STAFF } from "@/server/modules/resource";
import { getStructure } from "@/server/modules/institutions/structure.service";

/** GET: the signed-in institution's own structure: faculty -> department -> qualification -> study program. */
export const GET = handler({ auth: INSTITUTION_STAFF.read }, async ({ user }) => ok({ data: await getStructure(INSTITUTION_STAFF.scope!(user).institutionId!) }));
