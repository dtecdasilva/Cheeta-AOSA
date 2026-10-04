import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { findProtectedRule, ROLE_HOME } from "@/lib/auth/roles";

/**
 * This is the first line of defense: it runs on the Edge, before any page
 * or layout renders, and decides — purely from the URL and the signed
 * session cookie — whether the request is even allowed to reach the route
 * it asked for. A student changing the URL to /institution/dashboard never
 * gets far enough to see that page's code run; they're redirected here.
 *
 * Layouts in each portal call requireRole() again server-side (see
 * lib/auth/guard.ts) as defense in depth, in case a route is ever reached
 * by a path this matcher doesn't cover.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = findProtectedRule(pathname);
  if (!rule) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(token);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.status !== "ACTIVE") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "account_inactive");
    return NextResponse.redirect(loginUrl);
  }

  if (!rule.roles.includes(session.role)) {
    // Authenticated, but for a different portal — send them to their own
    // home rather than back to /login, since they don't need to sign in
    // again; they just don't belong on this URL.
    return NextResponse.redirect(new URL(ROLE_HOME[session.role] ?? "/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/institution/:path*", "/admin/:path*"],
};
