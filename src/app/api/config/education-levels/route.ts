import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { listEducationLevels } from "@/lib/education/configStore";

/**
 * Serves the configurable school-type/qualification lists that back the
 * Education Information form's dropdowns. The frontend has no hard-coded
 * qualification list anywhere — everything it shows comes from here, so
 * changing what's offered (adding a qualification, renaming a level) is a
 * data change in configStore.ts (and, later, an Admin UI action), never a
 * frontend code change.
 *
 * Read-only reference data, not sensitive — gated on "signed in" rather
 * than a specific role, reusing the existing session guard.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json({ levels: listEducationLevels() });
}
