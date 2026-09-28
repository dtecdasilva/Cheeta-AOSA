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
  ].join("\n");

  const preview: EmailPreview = { to: params.to, subject, body };

  // Stands in for an actual send until a provider is wired up.
  console.info("[email:dev-stub] would send:", preview);

  return preview;
}
