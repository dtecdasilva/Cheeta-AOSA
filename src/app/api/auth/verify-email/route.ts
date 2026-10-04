import { z } from "zod";
import { findUserById, markEmailVerified } from "@/lib/auth/users";
import { readEmailVerificationToken } from "@/lib/auth/session";
import { handler } from "@/server/http/handler";
import { BadRequestError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";

const body = z.object({ token: z.string().min(1, "The verification link is incomplete.") });

/**
 * POST { token }: confirms the email address a verification link was sent
 * to. Opening the same link twice is fine; the second time reports that
 * the address was already verified.
 */
export const POST = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "verify-email", 20, 15 * 60_000);
  const { token } = await parseBody(req, body);

  const invalid = new BadRequestError("This verification link is invalid or has expired. Ask for a new one.");
  const payload = await readEmailVerificationToken(token);
  if (!payload) throw invalid;
  const user = await findUserById(payload.sub);
  // The link is for one address: it stops working if the account's email has changed since.
  if (!user || user.email !== payload.email) throw invalid;

  const verifiedNow = await markEmailVerified(user.id);
  if (verifiedNow) await audit(getDb(), { action: "email_verified", entityType: "account", entityId: user.id, actorUserId: user.id, meta: { via: "link" } });
  return ok({ ok: true, alreadyVerified: !verifiedNow, email: user.email });
});
