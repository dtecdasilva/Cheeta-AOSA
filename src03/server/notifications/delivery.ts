import "server-only";
import { sendCredentialEmail, sendVerificationEmail, type EmailPreview } from "@/lib/notifications/email";
import { createEmailVerificationToken } from "@/lib/auth/session";
import { sendSms, registrationSmsMessage, type SmsPreview } from "@/lib/notifications/sms";
import { getDb } from "@/server/db/client";
import { credentialDeliveries } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { env } from "@/server/config/env";
import { logger } from "@/server/logging/logger";

/**
 * Sends login credentials and records each send in credential_deliveries,
 * so support can answer "did the code go out". The actual sending is the
 * existing email/SMS modules (src/lib/notifications); a real provider goes
 * in there.
 *
 * Previews of what was sent are returned only outside production, for the
 * registration screen's development hint. They contain the login code.
 */

export interface DeliveryResult {
  devEmailPreview?: EmailPreview;
  devSmsPreview?: SmsPreview;
}

async function record(userId: string, channel: "EMAIL" | "SMS", purpose: "REGISTRATION" | "PASSWORD_RESET" | "EMAIL_VERIFICATION", destination: string, ok: boolean) {
  await getDb()
    .insert(credentialDeliveries)
    .values({ id: newId("dlv"), userId, channel, purpose, destination, status: ok ? "SENT" : "FAILED" })
    .catch((err) => logger.error("Could not record credential delivery", { err, userId, channel }));
}

/** The page a verification link opens; it posts the token back to /api/auth/verify-email. */
export async function verificationUrlFor(user: { id: string; email: string }): Promise<string> {
  return `${env.APP_URL}/verify-email?token=${encodeURIComponent(await createEmailVerificationToken(user.id, user.email))}`;
}

export async function sendLoginCredentials(user: { id: string; email: string; fullName?: string; mobileNumber?: string | null }, temporaryCode: string): Promise<DeliveryResult> {
  const out: DeliveryResult = {};
  try {
    const preview = await sendCredentialEmail({ to: user.email, fullName: user.fullName, temporaryCode, verifyUrl: await verificationUrlFor(user) });
    await record(user.id, "EMAIL", "REGISTRATION", user.email, true);
    if (env.NODE_ENV !== "production") out.devEmailPreview = preview;
  } catch (err) {
    logger.error("Credential email failed", { err, userId: user.id });
    await record(user.id, "EMAIL", "REGISTRATION", user.email, false);
  }
  if (user.mobileNumber) {
    try {
      const preview = await sendSms({ to: user.mobileNumber, message: registrationSmsMessage() });
      await record(user.id, "SMS", "REGISTRATION", user.mobileNumber, true);
      if (env.NODE_ENV !== "production") out.devSmsPreview = preview;
    } catch (err) {
      logger.error("Registration SMS failed", { err, userId: user.id });
      await record(user.id, "SMS", "REGISTRATION", user.mobileNumber, false);
    }
  }
  return out;
}

/**
 * Records that a password reset link went out. There is no email provider
 * yet, so the forgot-password route still returns the link outside
 * production for testing.
 */
export async function recordPasswordResetSent(userId: string, email: string) {
  await record(userId, "EMAIL", "PASSWORD_RESET", email, true);
}

/** Sends the verification link again. Like the rest of this file, the preview is returned only outside production. */
export async function sendEmailVerification(user: { id: string; email: string; fullName?: string }): Promise<DeliveryResult> {
  const out: DeliveryResult = {};
  try {
    const preview = await sendVerificationEmail({ to: user.email, fullName: user.fullName, verifyUrl: await verificationUrlFor(user) });
    await record(user.id, "EMAIL", "EMAIL_VERIFICATION", user.email, true);
    if (env.NODE_ENV !== "production") out.devEmailPreview = preview;
  } catch (err) {
    logger.error("Verification email failed", { err, userId: user.id });
    await record(user.id, "EMAIL", "EMAIL_VERIFICATION", user.email, false);
  }
  return out;
}
