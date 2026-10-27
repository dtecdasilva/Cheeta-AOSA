import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getStaff, updateStaff } from "@/server/modules/institutions/staff.service";

const STAFF = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] as const;

export const GET = handler<{ id: string }>({ auth: STAFF }, async ({ params, user }) => ok({ data: await getStaff(user, params.id) }));

/** PATCH any of { fullName, phone, staffNo, position, title, role, status, permissions }. Institution administrators only. */
export const PATCH = handler<{ id: string }>({ auth: STAFF }, async ({ req, params, user }) => ok({ data: await updateStaff(user, params.id, await readJson(req)) }));
