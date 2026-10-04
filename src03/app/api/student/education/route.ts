import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createEducation, listEducation } from "@/server/modules/student/profile.service";

export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ records: await listEducation(user) }));

export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => {
  const record = await createEducation(user, ((await readJson(req)) ?? {}) as Record<string, unknown>);
  return created({ ok: true, record });
});
