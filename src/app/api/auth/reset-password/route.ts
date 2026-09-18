import { NextRequest, NextResponse } from "next/server";
import { findUserById, setUserPasswordHash, ACCOUNTS_COOKIE } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/password";
import { readResetToken } from "@/lib/auth/session";
import { PERSISTENT_COOKIE_OPTIONS } from "@/lib/cookieStore";

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const { token, password } = body;
  if (!token || !password) {
    return NextResponse.json({ error: "Reset token and new password are both required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const payload = await readResetToken(token);
  if (!payload) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const result = await setUserPasswordHash(user.id, hashPassword(password));
  const res = NextResponse.json({ ok: true });

  // If this account is cookie-tracked (registered at runtime, not one of
  // the seeded demo accounts), the updated hash must go out in the cookie
  // too — otherwise a different serverless instance would keep accepting
  // the OLD password. See src/lib/cookieStore.ts.
  if (result.accountsCookieValue) {
    res.cookies.set(ACCOUNTS_COOKIE, result.accountsCookieValue, PERSISTENT_COOKIE_OPTIONS);
  }

  return res;
}
