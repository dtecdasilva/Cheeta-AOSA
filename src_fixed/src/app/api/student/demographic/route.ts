import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { getDemographicProfile, upsertDemographicProfile, hydrateDemographicProfile } from "@/lib/demographic/store";
import { validateDemographicForSave, validateDemographicForSubmit } from "@/lib/demographic/validation";
import { EMPTY_DEMOGRAPHIC_PROFILE, DemographicProfile } from "@/lib/demographic/types";
import { readSignedCookie, buildSignedCookieValue, PERSISTENT_COOKIE_OPTIONS } from "@/lib/cookieStore";

/**
 * Every route in this file resolves the applicant from the session cookie
 * only — never from anything in the request body — so an applicant can
 * only ever read or write their own record. This reuses the exact same
 * session-checking used everywhere else (src/lib/auth/guard.ts); there is
 * no second/parallel auth path here.
 *
 * DEMOGRAPHIC_COOKIE exists for the same reason ACCOUNTS_COOKIE does (see
 * src/lib/cookieStore.ts and src/lib/auth/users.ts): on serverless hosting,
 * the in-memory store in demographic/store.ts only reliably reflects
 * whichever instance handled a given request. This cookie carries a
 * userId -> profile map with the browser so a save made against one
 * instance is still visible when the next request lands on another.
 */
const DEMOGRAPHIC_COOKIE = "aosa_demographic";

type ProfileMap = Record<string, DemographicProfile>;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Only applicants have demographic information." }, { status: 403 });
  }

  let profile = getDemographicProfile(user.id);
  if (!profile) {
    const cookieMap = (await readSignedCookie<ProfileMap>(DEMOGRAPHIC_COOKIE)) ?? {};
    const fromCookie = cookieMap[user.id];
    if (fromCookie) {
      hydrateDemographicProfile(user.id, fromCookie); // warm this instance for next time
      profile = fromCookie;
    }
  }

  return NextResponse.json({
    profile: profile ?? { ...EMPTY_DEMOGRAPHIC_PROFILE, updatedAt: "" },
    // Read straight from the account record, never from a second copy —
    // these are shown read-only on the form and are the same email/phone
    // captured at registration (src/lib/auth/users.ts).
    account: { email: user.email, telephone: user.mobileNumber ?? "" },
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Only applicants can save demographic information." }, { status: 403 });
  }

  let body: Partial<DemographicProfile> & { mode?: "save" | "submit"; email?: unknown; telephone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  // Email and registered telephone are populated from registration and are
  // protected from modification here regardless of what the client sends —
  // even if a request were crafted by hand, these two keys are dropped
  // before anything reaches the store.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mode, email: _ignoredEmail, telephone: _ignoredTelephone, ...patch } = body;

  const errors =
    mode === "submit" ? validateDemographicForSubmit(patch) : validateDemographicForSave(patch);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Some fields need attention.", fieldErrors: errors }, { status: 400 });
  }

  const saved = upsertDemographicProfile(user.id, patch);

  const cookieMap = (await readSignedCookie<ProfileMap>(DEMOGRAPHIC_COOKIE)) ?? {};
  cookieMap[user.id] = saved;

  const res = NextResponse.json({
    ok: true,
    profile: saved,
    account: { email: user.email, telephone: user.mobileNumber ?? "" },
  });
  res.cookies.set(DEMOGRAPHIC_COOKIE, await buildSignedCookieValue(cookieMap), PERSISTENT_COOKIE_OPTIONS);
  return res;
}
