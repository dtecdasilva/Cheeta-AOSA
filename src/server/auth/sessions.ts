import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { createSessionToken, SESSION_TTL_MS } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/users";
import { getDb } from "@/server/db/client";
import { authSessions } from "@/server/db/schema";
import { newId } from "@/server/db/ids";

/**
 * Server-side record of sign-ins (auth_sessions). The cookie holds a
 * signed token naming one of these rows; the row is what makes the token
 * good, so revoking the row signs that browser out wherever the token is.
 */

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
}

/** Opens a session for a user who has just proved who they are, and returns its token. */
export async function openSession(user: AuthUser, req: NextRequest): Promise<string> {
  const db = getDb();
  const id = newId("ses");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  // Housekeeping while we're here: this account's finished sessions aren't needed any more.
  await db.delete(authSessions).where(and(eq(authSessions.userId, user.id), or(lt(authSessions.expiresAt, new Date()), lt(authSessions.revokedAt, new Date()))));
  await db.insert(authSessions).values({ id, userId: user.id, expiresAt, ip: clientIp(req), userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null });
  return createSessionToken(user, id, expiresAt.getTime());
}

/** True while the session row exists for this user, isn't revoked and hasn't expired. */
export async function isSessionLive(sessionId: string | undefined, userId: string): Promise<boolean> {
  if (!sessionId) return false;
  const [row] = await getDb()
    .select({ expiresAt: authSessions.expiresAt, revokedAt: authSessions.revokedAt })
    .from(authSessions)
    .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)))
    .limit(1);
  return !!row && !row.revokedAt && row.expiresAt > new Date();
}

/** Ends one session (sign-out). */
export async function revokeSession(sessionId: string) {
  await getDb().update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
}

/** Ends every session an account has, e.g. after a password reset. */
export async function revokeAllSessions(userId: string) {
  await getDb().update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}
