import { z } from "zod";
import { findUserById, setUserPasswordHash } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/password";
import { readResetToken } from "@/lib/auth/session";
import { handler } from "@/server/http/handler";
import { BadRequestError, ValidationError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { getSettings } from "@/server/modules/settings/settings.service";
import { audit } from "@/server/audit/audit";
import { revokeAllSessions } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";

const body = z.object({
  token: z.string().min(1, "Reset token and new password are both required."),
  password: z.string().min(1, "Reset token and new password are both required.").max(200),
});

export const POST = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "reset-password", 10, 15 * 60_000);
  const { token, password } = await parseBody(req, body);
  const { passwordMinLength } = await getSettings("system");
  if (password.length < passwordMinLength) {
    const message = `Password must be at least ${passwordMinLength} characters.`;
    throw new ValidationError({ password: message }, message);
  }

  const expired = new BadRequestError("This reset link is invalid or has expired.");
  const payload = await readResetToken(token);
  if (!payload) throw expired;
  const user = await findUserById(payload.sub);
  // A completed reset bumps the session version, so each link works once.
  if (!user || (payload.ver ?? 1) !== user.sessionVersion) throw expired;

  await setUserPasswordHash(user.id, hashPassword(password));
  await revokeAllSessions(user.id);
  await audit(getDb(), { action: "password_reset", entityType: "account", entityId: user.id, actorUserId: user.id });
  return ok({ ok: true });
});
