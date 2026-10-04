import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { deleteResult, updateResult } from "@/server/modules/student/examinations.service";

/** One of the applicant's own results. */
export const PATCH = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => ok({ ok: true, result: await updateResult(user, params.id, await readJson(req)) }));

export const DELETE = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => {
  await deleteResult(user, params.id);
  return ok({ ok: true });
});
