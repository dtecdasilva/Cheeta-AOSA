import type { PublicUser } from "./users";

/**
 * The institution a portal user acts for: always their own, from their
 * account. There is no fallback to another institution: every institution
 * account is created against one, and the server confines every request to
 * the institution on the signed-in session whatever a screen passes.
 */
export function resolveInstitutionId(user: PublicUser): string {
  return user.institutionId ?? "";
}
