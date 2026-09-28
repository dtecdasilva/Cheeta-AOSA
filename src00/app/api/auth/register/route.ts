import { NextRequest, NextResponse } from "next/server";
import { createApplicantAccount, findUserByEmail, ACCOUNTS_COOKIE } from "@/lib/auth/users";
import { PERSISTENT_COOKIE_OPTIONS } from "@/lib/cookieStore";
import {
  validateEmail,
  validateMobileNumber,
  validateInstitutionType,
  normalizeMobileNumber,
} from "@/lib/validation";
import { InstitutionType } from "@/lib/types";
import { sendCredentialEmail } from "@/lib/notifications/email";
import { sendSms, registrationSmsMessage } from "@/lib/notifications/sms";

export async function POST(req: NextRequest) {
  let body: { email?: string; institutionType?: string; mobileNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const institutionType = (body.institutionType ?? "").trim();
  const mobileNumberRaw = (body.mobileNumber ?? "").trim();

  // 1. Validate the email.
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    return NextResponse.json({ error: emailCheck.message, field: "email" }, { status: 400 });
  }

  // 2. Validate the mobile number.
  const mobileCheck = validateMobileNumber(mobileNumberRaw);
  if (!mobileCheck.valid) {
    return NextResponse.json({ error: mobileCheck.message, field: "mobileNumber" }, { status: 400 });
  }

  // 3. Validate the institution type.
  const institutionCheck = validateInstitutionType(institutionType);
  if (!institutionCheck.valid) {
    return NextResponse.json({ error: institutionCheck.message, field: "institutionType" }, { status: 400 });
  }

  // Duplicate-account guard: don't create a second account for an email
  // that already has one — tell the applicant plainly and point them to
  // sign in instead, rather than silently failing or double-registering.
  if (await findUserByEmail(email)) {
    return NextResponse.json(
      {
        error: "An account already exists for this email address.",
        accountExists: true,
      },
      { status: 409 }
    );
  }

  const mobileNumber = normalizeMobileNumber(mobileNumberRaw);

  // 4. Create the applicant account, 5. generate a secure temporary login code.
  const result = await createApplicantAccount({
    email,
    institutionType: institutionType as InstitutionType,
    mobileNumber,
  });

  if (result.status === "exists") {
    // Extremely unlikely race with the check above, but handle it the
    // same way rather than risk a duplicate.
    return NextResponse.json(
      { error: "An account already exists for this email address.", accountExists: true },
      { status: 409 }
    );
  }

  // 6. Send the login credential to the registered email.
  const emailPreview = await sendCredentialEmail({
    to: result.user.email,
    temporaryCode: result.temporaryCode,
  });

  // 7. Send an SMS notification telling the applicant to check their email.
  const smsPreview = await sendSms({
    to: result.user.mobileNumber!,
    message: registrationSmsMessage(),
  });

  const res = NextResponse.json({
    ok: true,
    applicant: {
      email: result.user.email,
      institutionType: result.user.institutionType,
      mobileNumber: result.user.mobileNumber,
    },
    // These previews exist only because no real email/SMS provider is
    // connected yet (see lib/notifications/*). In production, neither
    // the temporary code nor these bodies would ever appear in an API
    // response — they'd go out solely through the provider.
    devEmailPreview: emailPreview,
    devSmsPreview: smsPreview,
  });

  // Deployed to serverless hosting, the next request (e.g. logging in with
  // this brand-new account) can land on a different instance than this one,
  // which wouldn't have this account in memory at all. This cookie is what
  // makes that work anyway — see src/lib/cookieStore.ts.
  res.cookies.set(ACCOUNTS_COOKIE, result.accountsCookieValue, PERSISTENT_COOKIE_OPTIONS);

  return res;
}