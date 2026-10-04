import { z } from "zod";
import { findUserByEmail, markEmailVerified, recordFailedLogin, recordSuccessfulLogin, toPublicUser } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { openSession } from "@/server/auth/sessions";
import { ROLE_HOME } from "@/lib/auth/roles";
import { handler } from "@/server/http/handler";
import { ForbiddenError, TooManyRequestsError, UnauthorizedError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { getSettings } from "@/server/modules/settings/settings.service";
import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";

const body = z.object({
  email: z.string().trim().min(1, "Email and password are both required."),
  password: z.string().min(1, "Email and password are both required."),
});

export const POST = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "login", 20, 10 * 60_000);
  const { email, password } = await parseBody(req, body);
  const user = await findUserByEmail(email);

  // The same answer for "no such account" and "wrong password", so the
  // endpoint can't be used to find out which emails are registered.
  const invalid = new UnauthorizedError("Incorrect email or password.");
  if (!user) throw invalid;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new TooManyRequestsError(`Too many failed sign-ins. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }

  if (!verifyPassword(password, user.passwordHash)) {
    const { lockoutAttempts } = await getSettings("system");
    await recordFailedLogin(user.id, lockoutAttempts);
    await audit(getDb(), { action: "login_failed", entityType: "account", entityId: user.id, actorUserId: user.id });
    throw invalid;
  }

  if (user.status === "INACTIVE") throw new ForbiddenError("This account has been deactivated. Contact your administrator.");

  await recordSuccessfulLogin(user.id);
  // A password only ever reaches its owner by email (the registration or
  // invitation code, or a reset link), so the first sign-in proves the address.
  if (!user.emailVerifiedAt && (await markEmailVerified(user.id))) {
    user.emailVerifiedAt = new Date().toISOString();
    await audit(getDb(), { action: "email_verified", entityType: "account", entityId: user.id, actorUserId: user.id, meta: { via: "first_sign_in" } });
  }
  await audit(getDb(), { action: "login", entityType: "account", entityId: user.id, actorUserId: user.id, institutionId: user.institutionId });
  const res = ok({ user: toPublicUser(user), redirectTo: ROLE_HOME[user.role] });
  res.cookies.set(SESSION_COOKIE, await openSession(user, req), SESSION_COOKIE_OPTIONS);
  return res;
});
