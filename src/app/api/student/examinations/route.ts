import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createExamination, listExaminations } from "@/server/modules/student/examinations.service";

/**
 * The applicant's own examinations.
 *
 *   GET   every examination created, each with its sittings and how many
 *         results have been recorded against each sitting.
 *   POST  { qualification, sittings: [{ examinationYear, candidateNumber,
 *         centreNumber }] }
 *
 * An examination has no subjects. The results obtained in it are added
 * afterwards, to one of its sittings, through /api/student/results.
 *
 * One record per qualification: a second one for the same qualification
 * is a 409. A rejected record is a 400 with `fieldErrors` keyed by where
 * the problem is ("sittings.0.examinationYear").
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ records: await listExaminations(user) }));

export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => created({ ok: true, record: await createExamination(user, await readJson(req)) }));
