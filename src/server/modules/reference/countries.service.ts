import "server-only";
import { asc, eq } from "drizzle-orm";
import { OTHER_COUNTRY } from "@/lib/countries/getCountries";
import type { Executor } from "@/server/db/client";
import { countries } from "@/server/db/schema";

/**
 * The country names applicant forms may currently store: the active
 * countries, split by what each is offered for, plus "Other" (always
 * accepted, for an applicant whose country isn't listed).
 *
 * `keep` adds names a record already holds, so a country that has since
 * been deactivated doesn't stop its owner saving the rest of the record.
 */
export async function offeredCountries(db: Executor, keep: (string | null | undefined)[] = []) {
  const rows = await db
    .select({ name: countries.name, nationality: countries.nationality, residence: countries.residence })
    .from(countries)
    .where(eq(countries.status, "ACTIVE"))
    .orderBy(asc(countries.sortOrder), asc(countries.name));
  const extra = [OTHER_COUNTRY, ...keep.filter((n): n is string => !!n)];
  return {
    all: [...rows.map((r) => r.name), ...extra],
    nationality: [...rows.filter((r) => r.nationality).map((r) => r.name), ...extra],
    residence: [...rows.filter((r) => r.residence).map((r) => r.name), ...extra],
  };
}
