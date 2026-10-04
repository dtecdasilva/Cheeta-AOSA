import { and, asc, eq } from "drizzle-orm";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDb } from "@/server/db/client";
import { institutions, parameters } from "@/server/db/schema";
import { applicationFeeFor } from "@/server/modules/applications/applications.queries";

/** Institutions accepting applications, for discovery and Add Institution. */
export const GET = handler({ auth: "authenticated" }, async () => {
  const db = getDb();
  const rows = await db
    .select({ id: institutions.id, name: institutions.name, typeId: institutions.typeId, typeLabel: parameters.label, regionId: institutions.regionId, townId: institutions.townId, webFee: institutions.webFee, website: institutions.website })
    .from(institutions)
    .innerJoin(parameters, eq(parameters.id, institutions.typeId))
    .where(and(eq(institutions.status, "ACTIVE")))
    .orderBy(asc(institutions.name));
  const data = await Promise.all(rows.map(async (r) => ({ ...r, applicationFee: await applicationFeeFor(db, r.id) })));
  return ok({ data });
});
