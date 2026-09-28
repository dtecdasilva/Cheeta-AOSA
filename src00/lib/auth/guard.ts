import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionToken, SESSION_COOKIE } from "./session";
import { findUserById, toPublicUser, PublicUser } from "./users";
import { Role, ROLE_HOME } from "./roles";

/**
 * Reads and validates the session cookie for use inside Server Components.
 * This is the second line of defense behind the middleware: the middleware
 * keeps mismatched requests from ever reaching a page, and this re-checks
 * the same session at render time so a layout never trusts the URL alone.
 */
export async function getSessionUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = await readSessionToken(token);
  if (!payload) return null;
  const user = await findUserById(payload.sub);
  if (!user || user.status !== "ACTIVE") return null;
  return toPublicUser(user);
}

/**
 * Use at the top of a portal's server layout: redirects to /login if there
 * is no valid session, or to the caller's own portal home if their role
 * isn't one of `allowed` — a student can never land on an institution or
 * admin page, even by typing the URL directly, because this runs on the
 * server before any of that page's content is rendered.
 */
export async function requireRole(allowed: Role[]): Promise<PublicUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!allowed.includes(user.role)) {
    // Send them to their OWN portal rather than a dead end: they are
    // authenticated and have somewhere legitimate to be, they just don't
    // belong on this URL. This matches what the proxy already does for
    // requests it intercepts before render. /unauthorized remains the
    // fallback for a role with no home mapping.
    redirect(ROLE_HOME[user.role] ?? "/unauthorized");
  }
  return user;
}

export function homeForRole(role: Role): string {
  return ROLE_HOME[role];
}
