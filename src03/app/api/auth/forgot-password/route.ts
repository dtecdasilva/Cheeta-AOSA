import { z } from "zod";
import { findUserByEmail } from "@/lib/auth/users";
import { createResetToken } from "@/lib/auth/session";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { env } from "@/server/config/env";
import { recordPasswordResetSent } from "@/server/notifications/delivery";

const body = z.object({ email: z.string().trim().min(1, "Enter your email address.") });

/**
 * Always answers success, whether or not the account exists, so the
 * endpoint can't reveal which emails are registered. With no email
 * provider connected yet, the reset link is returned outside production
 * so the flow can be tested; in production it would only be emailed.
 */
export const POST = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "forgot-password", 5, 15 * 60_000);
  const { email } = await parseBody(req, body);
  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") return ok({ ok: true, resetUrl: null });

  const token = await createResetToken(user.id, user.sessionVersion);
  await recordPasswordResetSent(user.id, user.email);
  const resetUrl = `/reset-password?token=${encodeURIComponent(token)}`;
  return ok({ ok: true, resetUrl: env.NODE_ENV === "production" ? null : resetUrl });
});
