import { eq } from "drizzle-orm";
import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { ForbiddenError } from "@/server/http/errors";
import { getDb } from "@/server/db/client";
import { institutions } from "@/server/db/schema";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { webFeeFor } from "@/server/modules/fees/calculation";
import { feeResource } from "@/server/modules/institutions/institutions.resources";
import { createResource, INSTITUTION_STAFF, listResource } from "@/server/modules/resource";

/**
 * The signed-in institution's own fee schedule.
 *
 *   GET   ?type=&category=&currency=&status=&q=  its fees, plus `webFee`:
 *         the platform web fee its applicants pay on top, which the Cheeta
 *         administrator sets and the institution can see but not change.
 *   POST  { name, type, category, currency, amount, effectiveDate, effectiveTo?, notes? }
 *         adds a fee. Institution administrators only.
 *
 * The institution is always the caller's own, whatever the request says.
 */
export const GET = handler({ auth: INSTITUTION_STAFF.read }, async ({ req, user }) => {
  const scope = INSTITUTION_STAFF.scope!(user);
  const db = getDb();
  const [list, [institution]] = await Promise.all([listResource(feeResource, req, scope), db.select({ webFee: institutions.webFee }).from(institutions).where(eq(institutions.id, scope.institutionId!)).limit(1)]);
  return ok({ ...list, webFee: { amount: await webFeeFor(db, institution?.webFee ?? null), currency: BASE_CURRENCY } });
});

export const POST = handler({ auth: INSTITUTION_STAFF.read }, async ({ req, user }) => {
  if (!INSTITUTION_STAFF.write.includes(user.role)) throw new ForbiddenError();
  return created({ data: await createResource(feeResource, await readJson(req), INSTITUTION_STAFF.scope!(user)) });
});
