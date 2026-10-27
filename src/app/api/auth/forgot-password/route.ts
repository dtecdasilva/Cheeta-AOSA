import { z } from "zod";
import { findUserByEmail } from "@/lib/auth/users";
import { createResetToken } from "@/lib/auth/session";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { env } from "@/server/config/env";
import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";
import { sendPasswordReset } from "@/server/notifications/delivery";

const body = z.object({ email: z.string().trim().min(1, "Enter your email address.") });

/**
 * Always answers success, whether or not the account exists, so the
 * endpoint can't reveal which emails are registered. The link is emailed
 * through the notification engine ("Password reset requested").
 */
export const POST = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "forgot-password", 5, 15 * 60_000);
  const { email } = await parseBody(req, body);
  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") {
    await audit(getDb(), { action: "password_reset_requested", entityType: "account", entityId: user?.id ?? null, meta: { outcome: user ? "inactive_account" : "unknown_email" } });
    return ok({ ok: true, resetUrl: null });
  }

  const token = await createResetToken(user.id, user.sessionVersion);
  await sendPasswordReset(user, token);
  await audit(getDb(), { action: "password_reset_requested", entityType: "account", entityId: user.id, actorUserId: user.id, meta: { outcome: "sent" } });
  // Outside production the link is also returned, so the flow can be tried without a mail provider.
  const resetUrl = `/reset-password?token=${encodeURIComponent(token)}`;
  return ok({ ok: true, resetUrl: env.NODE_ENV === "production" ? null : resetUrl });
});
