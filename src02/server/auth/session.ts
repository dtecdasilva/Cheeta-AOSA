import "server-only";
import { readSessionToken } from "@/lib/auth/session";
import { findUserById, toPublicUser, type PublicUser } from "@/lib/auth/users";

/**
 * Turns a session cookie value into the signed-in user, or null. Shared by
 * page guards (src/lib/auth/guard.ts) and API handlers (../http/handler.ts)
 * so both apply the same rules: a valid signature, not expired, the
 * account still exists and is active, and the token's session version
 * matches the account's (a password reset or deactivation ends sessions).
 *
 * The Edge proxy only checks the signature; this is the authoritative check.
 */
export async function resolveSession(token: string | undefined | null): Promise<PublicUser | null> {
  const payload = await readSessionToken(token);
  if (!payload) return null;
  const user = await findUserById(payload.sub);
  if (!user || user.status !== "ACTIVE") return null;
  if ((payload.ver ?? 1) !== user.sessionVersion) return null;
  return toPublicUser(user);
}
