import { z } from "zod";
import { createApplicantAccount } from "@/lib/auth/users";
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
 * Applicant self-registration. Validation is the registration form's own
 * (src/lib/validation.ts); errors name the field the way the form expects.
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
    applicant: { email: result.user.email, institutionType: result.user.institutionType, mobileNumber: result.user.mobileNumber },
    // Development only (see server/notifications/delivery.ts): these contain the login code.
    ...delivery,
  });
});
