import "server-only";
import { createEmailVerificationToken } from "@/lib/auth/session";
import { getDb } from "@/server/db/client";
import { credentialDeliveries } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { env } from "@/server/config/env";
import { logger } from "@/server/logging/logger";
import { sendNow, type SendNowResult } from "./engine";

/**
 * Login details, email confirmation and password reset links. They go
 * through the notification engine (templates "Account created", "Confirm
 * email address", "Password reset requested") and are sent at once, with
 * the code or link masked in the delivery record. Each send is also noted
 * in credential_deliveries, which support already reads.
 *
 * Previews of what was sent are returned only outside production, for the
 * screens' development hints. They contain the login code or link.
 */

export interface DeliveryResult {
  devEmailPreview?: SendNowResult["devEmailPreview"];
  devSmsPreview?: SendNowResult["devSmsPreview"];
}

async function record(userId: string, purpose: "REGISTRATION" | "PASSWORD_RESET" | "EMAIL_VERIFICATION", destination: string, r: SendNowResult) {
  if (r.email === null || r.email === "SKIPPED") return;
  await getDb()
    .insert(credentialDeliveries)
    .values({ id: newId("dlv"), userId, channel: "EMAIL", purpose, destination, status: r.email === "SENT" ? "SENT" : "FAILED" })
    .catch((err) => logger.error("Could not record credential delivery", { err, userId }));
}

const preview = (r: SendNowResult): DeliveryResult => ({ ...(r.devEmailPreview ? { devEmailPreview: r.devEmailPreview } : {}), ...(r.devSmsPreview ? { devSmsPreview: r.devSmsPreview } : {}) });

/** The page a verification link opens; it posts the token back to /api/auth/verify-email. */
export async function verificationUrlFor(user: { id: string; email: string }): Promise<string> {
  return `${env.APP_URL}/verify-email?token=${encodeURIComponent(await createEmailVerificationToken(user.id, user.email))}`;
}

/** The address a reset token is used at. */
export function resetUrlFor(token: string): string {
  return `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

/** A new account's login details, by email (and SMS, if there is a template for it and a mobile number). */
export async function sendLoginCredentials(user: { id: string; email: string; fullName?: string; mobileNumber?: string | null }, temporaryCode: string): Promise<DeliveryResult> {
  const r = await sendNow({ event: "registration.account_created", to: { userId: user.id }, values: { "login.code": temporaryCode, "verify.url": await verificationUrlFor(user) } });
  await record(user.id, "REGISTRATION", user.email, r);
  return preview(r);
}

/** A link to choose a new password. */
export async function sendPasswordReset(user: { id: string; email: string }, token: string): Promise<DeliveryResult> {
  const r = await sendNow({ event: "registration.password_reset", to: { userId: user.id }, values: { "reset.url": resetUrlFor(token) } });
  await record(user.id, "PASSWORD_RESET", user.email, r);
  return preview(r);
}

/** The email confirmation link again. */
export async function sendEmailVerification(user: { id: string; email: string }): Promise<DeliveryResult> {
  const r = await sendNow({ event: "registration.email_verification", to: { userId: user.id }, values: { "verify.url": await verificationUrlFor(user) } });
  await record(user.id, "EMAIL_VERIFICATION", user.email, r);
  return preview(r);
}
