import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createStaff, listStaff } from "@/server/modules/institutions/staff.service";

/** The caller's institution's users. Any staff member may read it; only an institution administrator may add to it. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await listStaff(user) }));

/** POST { fullName, email, phone?, role, staffNo, position, title?, permissions? }: adds a user and sends their sign-in details. */
export const POST = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => NextResponse.json(await createStaff(user, await readJson(req)), { status: 201 }));
