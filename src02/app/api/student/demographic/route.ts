import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getDemographic, saveDemographic } from "@/server/modules/student/profile.service";

/**
 * The applicant's own demographic record. Email and telephone come from
 * the account and are shown read-only; they can't be changed here.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) =>
  ok({ profile: await getDemographic(user), account: { email: user.email, telephone: user.mobileNumber ?? "" } })
);

export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const profile = await saveDemographic(user, body ?? {});
  return ok({ ok: true, profile, account: { email: user.email, telephone: user.mobileNumber ?? "" } });
});
