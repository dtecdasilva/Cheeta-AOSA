import { COUNTRIES } from "./data";

/**
 * Returns the list of countries. Deliberately shaped as a Promise even
 * though today it just resolves the static mock list in data.ts —
 * "these components will eventually be database-backed" means the swap
 * should be to the body of this one function (e.g. `fetch("/api/config/countries")`),
 * not to every component that currently calls it. <CountrySelect> and
 * anything else that needs the list should always go through this
 * function, never import COUNTRIES directly.
 *
 * Cached at module scope so multiple <CountrySelect> instances on the
 * same page (e.g. Country of Birth + Nationality + Country of Residence
 * all on one form) don't each re-resolve their own copy — and, once this
 * really is a network call, don't each fire their own redundant request.
 */
let cached: Promise<string[]> | null = null;

export function getCountries(): Promise<string[]> {
  if (!cached) {
    cached = Promise.resolve([...COUNTRIES]);
  }
  return cached;
}
