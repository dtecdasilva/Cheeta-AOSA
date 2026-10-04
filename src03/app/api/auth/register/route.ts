import { z } from "zod";
import { createApplicantAccount, registrationStatusOf } from "@/lib/auth/users";
import { createRegistrationStatusToken } from "@/lib/auth/session";
import { validateEmail, validateMobileNumber, validateInstitutionType, normalizeMobileNumber } from "@/lib/validation";
import type { InstitutionType } from "@/lib/types";
import { handler } from "@/server/http/handler";
import { BadRequestError, ConflictError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { rateLimit } from "@/server/http/rateLimit";
import { sendLoginCredentials } from "@/server/notifications/delivery";
import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";

const body = z.object({
  email: z.string().trim().default(""),
  institutionType: z.string().trim().default(""),
  mobileNumber: z.string().trim().default(""),
});

/**
 * Applicant self-registration: POST { email, institutionType, mobileNumber }.
 *
 * - Validation is the registration form's own (src/lib/validation.ts);
 *   a rejected field comes back as 400 with `field` naming it.
 * - One account per email address, compared case-insensitively. A second
 *   registration with the same address is refused with 409 and
 *   `accountExists: true`; nothing is created or sent. (Mobile numbers are
 *   not required to be unique: families share phones.)
 * - On success the account and its applicant profile exist, with status
 *   PENDING_VERIFICATION. The email carries a temporary login code and a
 *   verification link; either one verifies the address.
 * - `statusToken` lets the screen that registered ask how verification is
 *   going (GET /api/auth/register/status) without being signed in.
 */
export const POST = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "register", 10, 60 * 60_000);
  const { email, institutionType, mobileNumber } = await parseBody(req, body);

  const checks = [
    ["email", validateEmail(email)],
    ["mobileNumber", validateMobileNumber(mobileNumber)],
    ["institutionType", validateInstitutionType(institutionType)],
  ] as const;
  for (const [field, check] of checks) {
    if (!check.valid) throw new BadRequestError(check.message ?? "Check this field.", { field });
  }

  const result = await createApplicantAccount({ email, institutionType: institutionType as InstitutionType, mobileNumber: normalizeMobileNumber(mobileNumber) });
  if (result.status === "exists") throw new ConflictError("An account already exists for this email address.", { accountExists: true });

  await audit(getDb(), { action: "register", entityType: "account", entityId: result.user.id, actorUserId: result.user.id });
  const delivery = await sendLoginCredentials(result.user, result.temporaryCode);
  return ok({
    ok: true,
    applicant: { email: result.user.email, institutionType: result.user.institutionType, mobileNumber: result.user.mobileNumber, registrationNo: result.user.registrationNo },
    registrationStatus: registrationStatusOf(result.user),
    statusToken: await createRegistrationStatusToken(result.user.id),
    // Development only (see server/notifications/delivery.ts): these contain the login code.
    ...delivery,
  });
});
