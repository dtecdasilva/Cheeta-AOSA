import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { updateEducationRecord, deleteEducationRecord } from "@/lib/education/store";
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireStudent();
  if ("error" in check) return check.error;
  const { id } = await params;

  // The record being edited may only exist in another instance's memory
  // and the browser's cookie — hydrate this instance first, or a valid
  // edit would incorrectly 404.
  await ensureHydrated(check.user.id);

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

  // updateEducationRecord only ever looks within this user's own records
  // (see lib/education/store.ts) — there is no code path here that could
  // update or even reveal the existence of another applicant's record.
  const updated = updateEducationRecord(check.user.id, id, {
    startYear: body.startYear!,
    endYear: body.endYear!,
    schoolName: body.schoolName!.trim(),
    country: body.country!,
    schoolType: body.schoolType!,
    qualification: body.qualification!,
  });

  if (!updated) {
    return NextResponse.json({ error: "Education record not found." }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, record: updated });
  res.cookies.set(EDUCATION_COOKIE, await buildUpdatedEducationCookie(check.user.id), PERSISTENT_COOKIE_OPTIONS);
  return res;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireStudent();
  if ("error" in check) return check.error;
  const { id } = await params;

  await ensureHydrated(check.user.id);

  const deleted = deleteEducationRecord(check.user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Education record not found." }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(EDUCATION_COOKIE, await buildUpdatedEducationCookie(check.user.id), PERSISTENT_COOKIE_OPTIONS);
  return res;
}
