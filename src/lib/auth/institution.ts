import type { PublicUser } from "./users";

/**
 * The institution a portal user is acting on behalf of.
 *
 * Every institution-portal screen must resolve this the SAME way. List
 * screens used to fall back to "inst-1" while detail screens fell back to
 * "" — so a record that appeared in a list could not be opened from it,
 * because the detail page's ownership check compared against an empty
 * string and never matched.
 *
 * The fallback exists because the seeded demo accounts are the only
 * institution users today; once accounts are always created against a real
 * institution, this can simply return `user.institutionId`.
 */
export const DEMO_INSTITUTION_ID = "inst-1";

export function resolveInstitutionId(user: PublicUser): string {
  return user.institutionId ?? DEMO_INSTITUTION_ID;
}
