import "server-only";
import { env } from "@/server/config/env";
import { logger } from "@/server/logging/logger";

/**
 * Email and SMS providers. The rest of the platform only ever calls
 * `emailProvider().send(...)` or `smsProvider().send(...)`, so changing
 * provider is a setting (EMAIL_PROVIDER, SMS_PROVIDER) and adding one is a
 * new entry below: an object with a name and a send function that throws
 * when the provider refuses the message.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Display name, from the system settings ("Cheeta AOSA Admissions"). */
  fromName: string;
}

export interface SmsMessage {
  to: string;
  text: string;
  /** Sender ID, from the system settings ("CHEETA"); providers that can't use one ignore it. */
  senderId: string;
}

export interface SendResult {
  /** The provider's id for the message, for tracing it with them. */
  providerRef?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SendResult>;
}

class ProviderError extends Error {}

async function post(url: string, init: { headers: Record<string, string>; body: string }, what: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: init.headers, body: init.body, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  if (!res.ok) throw new ProviderError(`${what} refused the message (${res.status}): ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** Writes the message to the log instead of sending it. Message bodies, which can hold login codes, are only logged outside production. */
const consoleEmail: EmailProvider = {
  name: "console",
  async send(m) {
    if (env.NODE_ENV === "production") logger.info("Email not sent: no provider configured", { to: m.to, subject: m.subject });
    else logger.info("Email (console provider)", { to: m.to, subject: m.subject, text: m.text });
    return {};
  },
};

/** https://resend.com — EMAIL_FROM, RESEND_API_KEY. */
const resendEmail: EmailProvider = {
  name: "resend",
  async send(m) {
    const body = await post(
      "https://api.resend.com/emails",
      {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${m.fromName} <${env.EMAIL_FROM}>`, to: [m.to], subject: m.subject, text: m.text }),
      },
      "Resend"
    );
    return { providerRef: typeof body.id === "string" ? body.id : undefined };
  },
};

/** Any HTTP endpoint: EMAIL_WEBHOOK_URL (+ EMAIL_WEBHOOK_TOKEN). Receives { to, subject, text, fromName, from }. */
const webhookEmail: EmailProvider = {
  name: "webhook",
  async send(m) {
    const body = await post(
      env.EMAIL_WEBHOOK_URL!,
      {
        headers: { "Content-Type": "application/json", ...(env.EMAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.EMAIL_WEBHOOK_TOKEN}` } : {}) },
        body: JSON.stringify({ ...m, from: env.EMAIL_FROM ?? null }),
      },
      "The email webhook"
    );
    return { providerRef: typeof body.id === "string" ? body.id : undefined };
  },
};

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

const consoleSms: SmsProvider = {
  name: "console",
  async send(m) {
    if (env.NODE_ENV === "production") logger.info("SMS not sent: no provider configured", { to: m.to });
    else logger.info("SMS (console provider)", { to: m.to, text: m.text });
    return {};
  },
};

/** https://twilio.com — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM. */
const twilioSms: SmsProvider = {
  name: "twilio",
  async send(m) {
    const sid = env.TWILIO_ACCOUNT_SID!;
    const body = await post(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: m.to, From: env.TWILIO_FROM!, Body: m.text }).toString(),
      },
      "Twilio"
    );
    return { providerRef: typeof body.sid === "string" ? body.sid : undefined };
  },
};

/** Any HTTP endpoint, e.g. a local aggregator: SMS_WEBHOOK_URL (+ SMS_WEBHOOK_TOKEN). Receives { to, text, senderId }. */
const webhookSms: SmsProvider = {
  name: "webhook",
  async send(m) {
    const body = await post(
      env.SMS_WEBHOOK_URL!,
      { headers: { "Content-Type": "application/json", ...(env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify(m) },
      "The SMS webhook"
    );
    return { providerRef: typeof body.id === "string" ? body.id : undefined };
  },
};

const EMAIL: Record<typeof env.EMAIL_PROVIDER, EmailProvider> = { console: consoleEmail, resend: resendEmail, webhook: webhookEmail };
const SMS: Record<typeof env.SMS_PROVIDER, SmsProvider> = { console: consoleSms, twilio: twilioSms, webhook: webhookSms };

export const emailProvider = (): EmailProvider => EMAIL[env.EMAIL_PROVIDER];
export const smsProvider = (): SmsProvider => SMS[env.SMS_PROVIDER];
