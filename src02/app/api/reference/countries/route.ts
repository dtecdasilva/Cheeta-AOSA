import { asc, eq } from "drizzle-orm";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDb } from "@/server/db/client";
import { countries } from "@/server/db/schema";

/** Active countries for nationality, birth and residence pickers. Public: the registration form needs it. */
export const GET = handler({ auth: "public" }, async () => {
  const rows = await getDb()
    .select({ id: countries.id, name: countries.name, iso2: countries.iso2, dialCode: countries.dialCode, nationality: countries.nationality, residence: countries.residence })
    .from(countries)
    .where(eq(countries.status, "ACTIVE"))
    .orderBy(asc(countries.name));
  return ok({ data: rows });
});
