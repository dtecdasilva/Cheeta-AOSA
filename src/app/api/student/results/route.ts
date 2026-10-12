import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createResult, listResults } from "@/server/modules/student/examinations.service";

/**
 * The applicant's own results.
 *
 *   GET   every result, each with the sitting and examination it belongs
 *         to, and `result` (Pass or Fail) worked out from the grade or
 *         score and the examination's pass criteria.
 *   POST  { sittingId, subject, value } for a grade or score, or
 *         { sittingId, subject, resultTypeId } for a result recorded
 *         without one, such as Absent.
 *
 * `sittingId` is a sitting of one of the examinations the applicant has
 * created (GET /api/student/examinations lists them). The subject and
 * grade are checked against that examination's qualification. One result
 * per sitting and subject: a second is a 409.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ results: await listResults(user) }));

export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => created({ ok: true, result: await createResult(user, await readJson(req)) }));
