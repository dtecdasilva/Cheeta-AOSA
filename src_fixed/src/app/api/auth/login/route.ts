import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, toPublicUser } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are both required." }, { status: 400 });
  }

  const user = await findUserByEmail(email);

  // Deliberately identical error for "no such user" and "wrong password" —
  // distinguishing them would let an attacker enumerate valid emails.
  const invalidCredentials = () =>
    NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });

  if (!user) return invalidCredentials();
  if (!verifyPassword(password, user.passwordHash)) return invalidCredentials();

  if (user.status === "INACTIVE") {
    return NextResponse.json(
      { error: "This account has been deactivated. Contact your administrator." },
      { status: 403 }
    );
  }

  const token = await createSessionToken(user);
  const res = NextResponse.json({ user: toPublicUser(user), redirectTo: ROLE_HOME[user.role] });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}
