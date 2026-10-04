/**
 * Email delivery — no real provider is connected yet (no SMTP/SES/etc.
 * credentials exist in this module), so this logs the message and hands
 * back a "preview" object the API response can surface for development
 * and testing. Swapping in a real provider later means replacing the body
 * of `sendCredentialEmail` only; every caller keeps working unchanged.
 */

export interface EmailPreview {
  to: string;
  subject: string;
  body: string;
}

export async function sendCredentialEmail(params: {
  to: string;
  fullName?: string;
  temporaryCode: string;
  /** Link that confirms the address belongs to the account's owner. */
  verifyUrl?: string;
}): Promise<EmailPreview> {
  const subject = "Your Cheeta AOSA Platform login details";
  const body = [
    `Hello${params.fullName ? " " + params.fullName : ""},`,
    "",
    "Your account on the Cheeta Academia Online School Application Platform is ready.",
    "",
    `Email: ${params.to}`,
    `Temporary login code: ${params.temporaryCode}`,
    "",
    "Go to the platform's sign-in page and use this code as your password. " +
      "You'll be able to continue your school application once you're signed in.",
    ...(params.verifyUrl ? ["", "To confirm this email address, open this link (signing in with the code above confirms it too):", params.verifyUrl] : []),
  ].join("\n");

  const preview: EmailPreview = { to: params.to, subject, body };

  // Stands in for an actual send until a provider is wired up. The body
  // carries a login code, so it is only printed outside production.
  if (process.env.NODE_ENV === "production") console.info("[email:stub] would send", { to: preview.to, subject: preview.subject });
  else console.info("[email:dev-stub] would send:", preview);

  return preview;
}

/** The verification link on its own, for "send it again". Carries no login code. */
export async function sendVerificationEmail(params: { to: string; fullName?: string; verifyUrl: string }): Promise<EmailPreview> {
  const subject = "Confirm your email address for the Cheeta AOSA Platform";
  const body = [
    `Hello${params.fullName ? " " + params.fullName : ""},`,
    "",
    "Open this link to confirm your email address on the Cheeta Academia Online School Application Platform:",
    params.verifyUrl,
    "",
    "The link works for 48 hours. If you didn't register, you can ignore this message.",
  ].join("\n");

  const preview: EmailPreview = { to: params.to, subject, body };
  if (process.env.NODE_ENV === "production") console.info("[email:stub] would send", { to: preview.to, subject: preview.subject });
  else console.info("[email:dev-stub] would send:", preview);
  return preview;
}
