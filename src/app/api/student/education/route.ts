import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { createEducationRecord } from "@/lib/education/store";
import { ensureHydrated, buildUpdatedEducationCookie, EDUCATION_COOKIE } from "@/lib/education/cookieSync";
import { validateEducationRecord } from "@/lib/education/validation";
import { EducationRecordInput } from "@/lib/education/types";
import { PERSISTENT_COOKIE_OPTIONS } from "@/lib/cookieStore";

async function requireStudent() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) } as const;
  if (user.role !== "STUDENT") {
    return {
      error: NextResponse.json({ error: "Only applicants have education records." }, { status: 403 }),
    } as const;
  }
  return { user } as const;
}

export async function GET() {
  const check = await requireStudent();
  if ("error" in check) return check.error;

  const records = await ensureHydrated(check.user.id);
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const check = await requireStudent();
  if ("error" in check) return check.error;
  await ensureHydrated(check.user.id); // don't lose cross-instance records this instance hasn't seen yet

  let body: Partial<EducationRecordInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const errors = validateEducationRecord(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Some fields need attention.", fieldErrors: errors }, { status: 400 });
  }

  const record = createEducationRecord(check.user.id, {
    startYear: body.startYear!,
    endYear: body.endYear!,
    schoolName: body.schoolName!.trim(),
    country: body.country!,
    schoolType: body.schoolType!,
    qualification: body.qualification!,
  });

  const res = NextResponse.json({ ok: true, record }, { status: 201 });
  res.cookies.set(EDUCATION_COOKIE, await buildUpdatedEducationCookie(check.user.id), PERSISTENT_COOKIE_OPTIONS);
  return res;
}
