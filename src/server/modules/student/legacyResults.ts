import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { examinationRecords, examinationResults, examinationSittingSubjects, examinationSittings } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { logger } from "@/server/logging/logger";

/**
 * Brings examination data recorded the old way into the new shape.
 *
 * Before, subjects and grades could be entered in two places: with the
 * examination itself (kept per sitting, in examination_sitting_subjects),
 * and on the Results form (kept per qualification, with no sitting). Now
 * an examination has no subjects, and every result belongs to a sitting.
 *
 * This runs at start-up and does nothing once there is nothing left to
 * move, so it is safe to run every time:
 *
 * 1. A result with no sitting is attached to the applicant's sitting of
 *    that qualification: the one the subject had been entered against, or
 *    the first. It stays unattached only if the applicant never created
 *    that examination (the Results form then shows it as needing one).
 * 2. A subject entered with an examination becomes a result of that
 *    sitting, unless the sitting already has a result for the subject
 *    (the Results form's entry wins). The old row is then removed.
 *
 * Nothing the applicant entered is discarded except an exact repeat.
 */
export async function adoptLegacyExaminationResults(db: Executor): Promise<void> {
  const [unattached, oldSubjects] = await Promise.all([
    db.select().from(examinationResults).where(isNull(examinationResults.sittingId)),
    db
      .select({ row: examinationSittingSubjects, userId: examinationRecords.userId, examTypeId: examinationRecords.examTypeId })
      .from(examinationSittingSubjects)
      .innerJoin(examinationSittings, eq(examinationSittings.id, examinationSittingSubjects.sittingId))
      .innerJoin(examinationRecords, eq(examinationRecords.id, examinationSittings.examinationRecordId))
      .orderBy(asc(examinationSittings.sittingNo), asc(examinationSittingSubjects.position)),
  ]);
  if (!unattached.length && !oldSubjects.length) return;

  let attached = 0;
  let moved = 0;
  for (const result of unattached) {
    const sittings = await db
      .select({ id: examinationSittings.id })
      .from(examinationSittings)
      .innerJoin(examinationRecords, eq(examinationRecords.id, examinationSittings.examinationRecordId))
      .where(and(eq(examinationRecords.userId, result.userId), eq(examinationRecords.examTypeId, result.examTypeId)))
      .orderBy(asc(examinationSittings.sittingNo));
    if (!sittings.length) continue;
    const ids = sittings.map((s) => s.id);
    const enteredAt = oldSubjects.find((o) => ids.includes(o.row.sittingId) && o.row.subject === result.subject)?.row.sittingId;
    const target = enteredAt ?? ids[0];
    const [taken] = await db
      .select({ id: examinationResults.id })
      .from(examinationResults)
      .where(and(eq(examinationResults.sittingId, target), eq(examinationResults.subject, result.subject)))
      .limit(1);
    if (taken) continue;
    await db.update(examinationResults).set({ sittingId: target }).where(eq(examinationResults.id, result.id));
    attached += 1;
  }

  for (const { row, userId, examTypeId } of oldSubjects) {
    const inserted = await db
      .insert(examinationResults)
      .values({ id: newId("res"), userId, sittingId: row.sittingId, examTypeId, subject: row.subject, value: row.value })
      .onConflictDoNothing()
      .returning({ id: examinationResults.id });
    moved += inserted.length;
  }
  if (oldSubjects.length) await db.delete(examinationSittingSubjects).where(inArray(examinationSittingSubjects.id, oldSubjects.map((o) => o.row.id)));

  logger.child({ module: "bootstrap" }).info("Examination results brought into the new shape", { attachedToAnExamination: attached, movedFromExaminations: moved, leftUnattached: unattached.length - attached });
}
