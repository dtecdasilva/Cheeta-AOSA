import { asc, eq } from "drizzle-orm";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDb } from "@/server/db/client";
import { countries } from "@/server/db/schema";

/**
 * Active countries for the birth, nationality, residence and school
 * pickers, in display order. `nationality` and `residence` say which
 * pickers each one is offered in. Public: the registration form needs it.
 */
export const GET = handler({ auth: "public" }, async () => {
  const rows = await getDb()
    .select({
      id: countries.id,
      name: countries.name,
      iso2: countries.iso2,
      iso3: countries.iso3,
      dialCode: countries.dialCode,
      region: countries.region,
      currencyCode: countries.currencyCode,
      nationality: countries.nationality,
      residence: countries.residence,
      sortOrder: countries.sortOrder,
    })
    .from(countries)
    .where(eq(countries.status, "ACTIVE"))
    .orderBy(asc(countries.sortOrder), asc(countries.name));
  return ok({ data: rows });
});
