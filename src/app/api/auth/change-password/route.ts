import { z } from "zod";
import { findUserById, setUserPasswordHash, toPublicUser } from "@/lib/auth/users";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { handler } from "@/server/http/handler";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { getSettings } from "@/server/modules/settings/settings.service";
import { audit } from "@/server/audit/audit";
import { openSession } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";

const body = z.object({
  currentPassword: z.string().max(200).optional(),
  password: z.string().min(1, "Enter a new password.").max(200),
});

/**
 * POST { currentPassword?, password }: the signed-in person chooses a new
 * password. The current one is asked for, except right after signing in
 * with an emailed temporary code, which the person has just typed. Every
 * other session of the account ends; this one carries on with a fresh
 * session.
 */
export const POST = handler({ auth: "authenticated" }, async ({ req, user: me }) => {
  rateLimit(req, "change-password", 20, 15 * 60_000, me.id);
  const v = await parseBody(req, body);
  const user = await findUserById(me.id);
  if (!user) throw new NotFoundError("Account");

  const { passwordMinLength } = await getSettings("system");
  if (v.password.length < passwordMinLength) throw new ValidationError({ password: `Password must be at least ${passwordMinLength} characters.` });
  if (!user.mustChangePassword && !verifyPassword(v.currentPassword ?? "", user.passwordHash)) throw new ValidationError({ currentPassword: "Your current password is not correct." });
  if (verifyPassword(v.password, user.passwordHash)) throw new ValidationError({ password: "Choose a password different from the current one." });

  await setUserPasswordHash(user.id, hashPassword(v.password));
  await audit(getDb(), { action: "password_changed", entityType: "account", entityId: user.id, actorUserId: user.id, institutionId: user.institutionId });
  // The new hash bumped the session version, ending every session; this one starts again.
  const fresh = (await findUserById(user.id))!;
  const res = ok({ user: toPublicUser(fresh), redirectTo: ROLE_HOME[fresh.role] });
  res.cookies.set(SESSION_COOKIE, await openSession(fresh, req), SESSION_COOKIE_OPTIONS);
  return res;
});
