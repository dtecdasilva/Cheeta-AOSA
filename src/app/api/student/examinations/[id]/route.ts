import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { deleteExamination, getExamination, updateExamination } from "@/server/modules/student/examinations.service";

/** One of the applicant's own examinations. PATCH replaces its qualification and sittings with what is sent. */
export const GET = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => ok({ record: await getExamination(user, params.id) }));

export const PATCH = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => ok({ ok: true, record: await updateExamination(user, params.id, await readJson(req)) }));

export const DELETE = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => {
  await deleteExamination(user, params.id);
  return ok({ ok: true });
});
