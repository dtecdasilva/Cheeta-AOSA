import { z } from "zod";
import { findUserByEmail } from "@/lib/auth/users";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { sendEmailVerification } from "@/server/notifications/delivery";

const body = z.object({ email: z.string().trim().min(1, "Enter your email address.") });

/**
 * POST { email }: sends the verification link again. Always answers
 * success, whether or not the address is registered or already verified,
 * so it can't be used to find out which emails have accounts.
 */
export const POST = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "resend-verification", 5, 15 * 60_000);
  const { email } = await parseBody(req, body);
  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE" || user.emailVerifiedAt) return ok({ ok: true });
  const delivery = await sendEmailVerification(user);
  // Development only (see server/notifications/delivery.ts).
  return ok({ ok: true, ...delivery });
});
