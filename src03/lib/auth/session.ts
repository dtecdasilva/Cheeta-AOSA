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
  /** The auth_sessions row this token belongs to; signing out revokes it. */
  sid?: string;
  exp: number;
  [key: string]: unknown;
}

export async function createSessionToken(
  user: { id: string; role: Role; status: AccountStatus; sessionVersion?: number },
  sessionId: string,
  expiresAt = Date.now() + SESSION_TTL_MS
): Promise<string> {
  return signToken({
    sub: user.id,
    role: user.role,
    status: user.status,
    ver: user.sessionVersion ?? 1,
    sid: sessionId,
    exp: expiresAt,
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

// Email-verification links: same mechanism, their own purpose claim, and
// the address they were issued for, so a link stops working if the
// account's email is changed after it was sent.
const VERIFY_TTL_MS = 1000 * 60 * 60 * 48; // 48 hours

export interface VerifyEmailPayload {
  sub: string;
  purpose: "verify_email";
  email: string;
  exp: number;
  [key: string]: unknown;
}

export async function createEmailVerificationToken(userId: string, email: string): Promise<string> {
  return signToken({ sub: userId, purpose: "verify_email", email: email.toLowerCase(), exp: Date.now() + VERIFY_TTL_MS });
}

export async function readEmailVerificationToken(token: string | undefined | null): Promise<VerifyEmailPayload | null> {
  const payload = await verifyToken<VerifyEmailPayload>(token);
  if (!payload || payload.purpose !== "verify_email") return null;
  return payload;
}

// Lets the registration screen ask "has this registration been verified
// yet?" for the account it just created, without a lookup by email that
// anyone could use to find out who is registered.
export interface RegistrationStatusPayload {
  sub: string;
  purpose: "registration_status";
  exp: number;
  [key: string]: unknown;
}

export async function createRegistrationStatusToken(userId: string): Promise<string> {
  return signToken({ sub: userId, purpose: "registration_status", exp: Date.now() + VERIFY_TTL_MS });
}

export async function readRegistrationStatusToken(token: string | undefined | null): Promise<RegistrationStatusPayload | null> {
  const payload = await verifyToken<RegistrationStatusPayload>(token);
  if (!payload || payload.purpose !== "registration_status") return null;
  return payload;
}
