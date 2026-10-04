import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createExamination, listExaminations } from "@/server/modules/student/examinations.service";

/**
 * The applicant's own examinations.
 *
 *   GET   every examination recorded, each with its sittings and subjects.
 *   POST  { qualification, sittings: [{ examinationYear, candidateNumber,
 *         centreNumber, subjectEntries: [{ subject, value }] }] }
 *
 * One record per qualification: a second one for the same qualification
 * is a 409. A rejected record is a 400 with `fieldErrors` keyed by where
 * the problem is ("sittings.0.examinationYear").
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ records: await listExaminations(user) }));

export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => created({ ok: true, record: await createExamination(user, await readJson(req)) }));
