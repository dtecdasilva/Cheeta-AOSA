/**
 * SMS delivery — no real gateway is connected yet (no Twilio/Vonage/etc.
 * credentials exist in this module), so this logs the message and hands
 * back a "preview" object the API response can surface for development
 * and testing. Swapping in a real gateway later means replacing the body
 * of `sendSms` only; every caller keeps working unchanged.
 */

export interface SmsPreview {
  to: string;
  message: string;
}

export async function sendSms(params: { to: string; message: string }): Promise<SmsPreview> {
  const preview: SmsPreview = { to: params.to, message: params.message };

  // Stands in for an actual send until a gateway is wired up.
  console.info("[sms:dev-stub] would send:", preview);

  return preview;
}

export function registrationSmsMessage(): string {
  return "Cheeta AOSA Platform: your account is ready. Check your email for your login details.";
}
