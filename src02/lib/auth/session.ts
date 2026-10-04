import { Role, AccountStatus } from "./roles";
import { signToken, verifyToken } from "./token";

export const SESSION_COOKIE = "aosa_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  status: AccountStatus;
  /** The account's session version when signed in; see users.session_version. */
  ver?: number;
  exp: number;
  [key: string]: unknown;
}

export async function createSessionToken(user: { id: string; role: Role; status: AccountStatus; sessionVersion?: number }): Promise<string> {
  return signToken({
    sub: user.id,
    role: user.role,
    status: user.status,
    ver: user.sessionVersion ?? 1,
    exp: Date.now() + SESSION_TTL_MS,
  });
}

export async function readSessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  return verifyToken<SessionPayload>(token);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

// Password-reset tokens reuse the same signed-token mechanism with a much
// shorter lifetime and a distinct "purpose" claim so a reset token can never
// be replayed as a session token or vice versa.
const RESET_TTL_MS = 1000 * 60 * 30; // 30 minutes

export interface ResetPayload {
  sub: string;
  purpose: "password_reset";
  /** Session version at issue time; a completed reset bumps it, so each link works once. */
  ver?: number;
  exp: number;
  [key: string]: unknown;
}

export async function createResetToken(userId: string, sessionVersion = 1): Promise<string> {
  return signToken({ sub: userId, purpose: "password_reset", ver: sessionVersion, exp: Date.now() + RESET_TTL_MS });
}

export async function readResetToken(token: string | undefined | null): Promise<ResetPayload | null> {
  const payload = await verifyToken<ResetPayload>(token);
  if (!payload || payload.purpose !== "password_reset") return null;
  return payload;
}
