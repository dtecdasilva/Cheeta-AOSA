import type { PublicUser } from "@/lib/auth/users";
import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createDemographic, getDemographicRecord, updateDemographic } from "@/server/modules/student/profile.service";

/**
 * The applicant's own demographic record. Every method is for the
 * signed-in applicant only and only ever touches their own record.
 *
 *   GET    Retrieve it (empty fields if nothing is saved yet), with its
 *          completion status.
 *   POST   Create it: the first save. 409 if it already exists.
 *   PATCH  Update it: only the fields sent change. 404 if it doesn't exist yet.
 *
 * POST and PATCH take the fields plus `mode`: "save" (the default) stores
 * a draft, where nothing is required but whatever is filled in must be
 * valid; "submit" completes the section and requires every required
 * field. A rejected request is a 400 with `fieldErrors` keyed by field.
 *
 * Email and telephone come from the account and are returned read-only;
 * they can't be changed here.
 */
const account = (user: PublicUser) => ({ email: user.email, telephone: user.mobileNumber ?? "" });

export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ ...(await getDemographicRecord(user)), account: account(user) }));

export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) =>
  created({ ok: true, ...(await createDemographic(user, await readJson(req))), account: account(user) })
);

export const PATCH = handler({ auth: ["STUDENT"] }, async ({ req, user }) =>
  ok({ ok: true, ...(await updateDemographic(user, await readJson(req))), account: account(user) })
);
