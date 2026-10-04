import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createResult, listResults } from "@/server/modules/student/examinations.service";

/**
 * The applicant's own subject results.
 *
 *   GET   every result, each with `result` (Pass or Fail) worked out from
 *         the grade or score and the qualification's pass criteria.
 *   POST  { qualification, subject, value } for a grade or score, or
 *         { qualification, subject, resultTypeId } for a result recorded
 *         without one, such as Absent.
 *
 * One result per qualification and subject: a second is a 409.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ results: await listResults(user) }));

export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => created({ ok: true, result: await createResult(user, await readJson(req)) }));
