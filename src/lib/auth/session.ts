import { Role, AccountStatus } from "./roles";
import { signToken, verifyToken } from "./token";

export const SESSION_COOKIE = "aosa_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  status: AccountStatus;
  exp: number;
  [key: string]: unknown;
}

export async function createSessionToken(user: { id: string; role: Role; status: AccountStatus }): Promise<string> {
  return signToken({
    sub: user.id,
    role: user.role,
    status: user.status,
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
  exp: number;
  [key: string]: unknown;
}

export async function createResetToken(userId: string): Promise<string> {
  return signToken({ sub: userId, purpose: "password_reset", exp: Date.now() + RESET_TTL_MS });
}

export async function readResetToken(token: string | undefined | null): Promise<ResetPayload | null> {
  const payload = await verifyToken<ResetPayload>(token);
  if (!payload || payload.purpose !== "password_reset") return null;
  return payload;
}
