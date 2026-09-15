import "server-only";
import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/auth/token";

/**
 * Vercel (and serverless hosting generally) runs this app as multiple
 * short-lived function instances rather than one persistent process, so
 * a plain `globalThis`-backed store (see auth/users.ts, demographic/store.ts,
 * education/store.ts) only reliably reflects state for whichever instance
 * happens to handle a given request — a different instance simply doesn't
 * have it in memory. That's invisible in this sandbox (`next start` is one
 * long-running process) and only shows up once deployed to Vercel, as data
 * that "randomly" disappears or a session that gets rejected right after
 * being created.
 *
 * This is the workaround for that, scoped deliberately to
 * "make it not matter for a frontend demo" rather than "build a database":
 * durable state is also written into a signed, httpOnly cookie, so it
 * travels with the browser to whichever instance handles the next request.
 * The `globalThis` stores stay in place as a same-instance fast path;
 * these cookies are the fallback that make cross-instance behavior work
 * too. Replacing this with a real database later means deleting this file
 * and the call sites that reference it — nothing else changes shape.
 */

export const PERSISTENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days — outlives a single login session on purpose
};

export async function readSignedCookie<T>(name: string): Promise<T | null> {
  const store = await cookies();
  const token = store.get(name)?.value;
  if (!token) return null;
  const payload = await verifyToken<{ data: T }>(token);
  return payload?.data ?? null;
}

export async function buildSignedCookieValue<T>(data: T): Promise<string> {
  return signToken({ data });
}
