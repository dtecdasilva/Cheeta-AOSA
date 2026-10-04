import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { deleteEducation, updateEducation } from "@/server/modules/student/profile.service";

export const PATCH = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => {
  const record = await updateEducation(user, params.id, ((await readJson(req)) ?? {}) as Record<string, unknown>);
  return ok({ ok: true, record });
});

export const DELETE = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => {
  await deleteEducation(user, params.id);
  return ok({ ok: true });
});
