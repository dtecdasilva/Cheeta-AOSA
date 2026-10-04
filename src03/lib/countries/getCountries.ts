import { COUNTRIES } from "./data";

/**
 * The countries offered on applicant forms, from the database
 * (GET /api/reference/countries, managed under Admin → System → Countries),
 * in the display order set there.
 *
 * <CountrySelect> and anything else that needs the list goes through this
 * function, never a list of its own. `purpose` narrows it to the countries
 * the administrators offer as a nationality or as a country of residence.
 *
 * "Other" is always the last option, for an applicant whose country isn't
 * listed; it isn't a database record.
 *
 * The answer is cached for the life of the page, so several pickers on one
 * form share a single request. If the request fails, the built-in list
 * (./data.ts, also what a new database is filled from) is used instead.
 */
export type CountryPurpose = "nationality" | "residence";

export const OTHER_COUNTRY = "Other";

interface CountryOption {
  name: string;
  nationality: boolean;
  residence: boolean;
}

let cached: Promise<CountryOption[]> | null = null;

async function load(): Promise<CountryOption[]> {
  const fallback = COUNTRIES.filter((name) => name !== OTHER_COUNTRY).map((name) => ({ name, nationality: true, residence: true }));
  if (typeof window === "undefined") return fallback;
  try {
    const res = await fetch("/api/reference/countries");
    if (!res.ok) return fallback;
    const body = (await res.json()) as { data: CountryOption[] };
    return body.data.length ? body.data : fallback;
  } catch {
    return fallback;
  }
}

export function getCountries(purpose?: CountryPurpose): Promise<string[]> {
  if (!cached) cached = load();
  return cached.then((list) => [...list.filter((c) => !purpose || c[purpose]).map((c) => c.name), OTHER_COUNTRY]);
}
