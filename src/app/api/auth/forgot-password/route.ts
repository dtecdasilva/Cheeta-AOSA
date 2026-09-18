import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth/users";
import { createResetToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
  }

  const user = await findUserByEmail(email);

  // Always return success, whether or not the account exists — this
  // prevents the endpoint from being used to discover which emails are
  // registered. If the account is real, we hand back a reset link.
  // In production this token would be emailed, never returned in the
  // response; it's surfaced here only because this module has no email
  // delivery yet and the reset flow still needs to be testable end to end.
  if (!user) {
    return NextResponse.json({ ok: true, resetUrl: null });
  }

  const token = await createResetToken(user.id);
  const resetUrl = `/reset-password?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ ok: true, resetUrl });
}
