import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { buildExamConfigurationData, computeResult, EXAM_PARAM_CATEGORIES, toExamConfiguration, type ExamConfiguration, type ExamConfigurationData, type ExamParam } from "@/lib/examination/config";
import type { ExaminationView, ResultView } from "@/lib/examination/records";
import { validateExamination, validateResult, type ExaminationInput, type ResultInput } from "@/lib/examination/validation";
import { getDb, type Executor } from "@/server/db/client";
import { examinationRecords, examinationResults, examinationSittings, parameters } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";

/**
 * Examinations and results: the configuration the forms are built from,
 * and each applicant's own records.
 *
 * The applicant first creates an examination (a qualification and its
 * sittings), then adds results to one of its sittings. A result can only
 * be added to a sitting the applicant has created, and its qualification
 * is that examination's, never one named in the request.
 *
 * Every function that takes the signed-in user only ever touches that
 * user's rows, and every save is checked against the configuration in
 * the database, whatever the client sent.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Examination types, subjects, grades, result types and sitting limits, built from the examination parameter lists. */
export async function getExamConfigurationData(db: Executor = getDb()): Promise<ExamConfigurationData> {
  const rows = await db
    .select({ id: parameters.id, category: parameters.category, code: parameters.code, label: parameters.label, status: parameters.status, order: parameters.sortOrder, attrs: parameters.attrs })
    .from(parameters)
    .where(inArray(parameters.category, EXAM_PARAM_CATEGORIES));
  return buildExamConfigurationData(rows as ExamParam[]);
}

const configuration = async (db: Executor): Promise<ExamConfiguration> => toExamConfiguration(await getExamConfigurationData(db));

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestError("Send the record as a JSON object.");
  return body as Record<string, unknown>;
}

/** An examination is its qualification and sittings. Anything else sent (subjects, from an older form) is not read. */
function readExamination(body: unknown): ExaminationInput {
  const input = asObject(body);
  const sittings = Array.isArray(input.sittings) ? input.sittings.slice(0, 20) : [];
  return {
    qualification: str(input.qualification),
    sittings: sittings.map((raw) => {
      const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return { examinationYear: str(s.examinationYear), candidateNumber: str(s.candidateNumber), centreNumber: str(s.centreNumber) };
    }),
  };
}

function readResult(body: unknown): ResultInput {
  const input = asObject(body);
  const resultTypeId = str(input.resultTypeId);
  return { sittingId: str(input.sittingId), subject: str(input.subject), value: resultTypeId ? "" : str(input.value), resultTypeId };
}

// ---------------------------------------------------------------------------
// Examinations
// ---------------------------------------------------------------------------

/** An applicant's examinations, each with its sittings and how many results are recorded at each. */
export async function loadExaminations(db: Executor, userId: string, onlyId?: string): Promise<ExaminationView[]> {
  const records = await db
    .select()
    .from(examinationRecords)
    .where(and(eq(examinationRecords.userId, userId), onlyId ? eq(examinationRecords.id, onlyId) : undefined))
    .orderBy(asc(examinationRecords.createdAt));
  if (!records.length) return [];

  const sittings = await db
    .select()
    .from(examinationSittings)
    .where(inArray(examinationSittings.examinationRecordId, records.map((r) => r.id)))
    .orderBy(asc(examinationSittings.sittingNo));
  const counts = sittings.length
    ? await db
        .select({ sittingId: examinationResults.sittingId, n: count() })
        .from(examinationResults)
        .where(inArray(examinationResults.sittingId, sittings.map((s) => s.id)))
        .groupBy(examinationResults.sittingId)
    : [];
  const resultsAt = new Map(counts.map((c) => [c.sittingId, Number(c.n)]));

  return records.map((r) => ({
    id: r.id,
    qualification: r.examTypeId,
    sittings: sittings
      .filter((s) => s.examinationRecordId === r.id)
      .map((s) => ({ id: s.id, sittingNo: s.sittingNo, examinationYear: String(s.year), candidateNumber: s.candidateNumber, centreNumber: s.centreNumber, resultCount: resultsAt.get(s.id) ?? 0 })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

async function assertNotDuplicate(tx: Executor, userId: string, qualification: string, exceptId?: string) {
  const [other] = await tx
    .select({ id: examinationRecords.id })
    .from(examinationRecords)
    .where(and(eq(examinationRecords.userId, userId), eq(examinationRecords.examTypeId, qualification)))
    .limit(1);
  if (other && other.id !== exceptId) throw new ConflictError("You've already added this examination. Edit it to change its sittings.", { fieldErrors: { qualification: "You've already added this examination." } });
}

export function listExaminations(user: PublicUser): Promise<ExaminationView[]> {
  return loadExaminations(getDb(), user.id);
}

export async function getExamination(user: PublicUser, id: string): Promise<ExaminationView> {
  const [record] = await loadExaminations(getDb(), user.id, id);
  if (!record) throw new NotFoundError("Examination");
  return record;
}

const sittingRow = (s: ExaminationInput["sittings"][number]) => ({ year: Number(s.examinationYear), candidateNumber: s.candidateNumber, centreNumber: s.centreNumber });

async function createExaminationNow(user: PublicUser, body: unknown): Promise<ExaminationView> {
  const input = readExamination(body);
  return getDb().transaction(async (tx) => {
    ValidationError.assert(validateExamination(input, await configuration(tx)));
    await assertNotDuplicate(tx, user.id, input.qualification);
    const id = newId("exm");
    await tx.insert(examinationRecords).values({ id, userId: user.id, examTypeId: input.qualification });
    await tx.insert(examinationSittings).values(input.sittings.map((s, i) => ({ id: newId("sit"), examinationRecordId: id, sittingNo: i + 1, ...sittingRow(s) })));
    const [saved] = await loadExaminations(tx, user.id, id);
    await audit(tx, { action: "create", entityType: "examination-record", entityId: id, before: null, after: saved as unknown as Record<string, unknown> });
    return saved;
  });
}

/**
 * Changes an examination's qualification and sittings to what was sent.
 *
 * Sittings are matched by position (the first sent is sitting 1) and
 * changed in place, so the results already recorded against a sitting
 * stay with it. Two changes would leave results without a home and are
 * refused until those results are removed: changing the qualification
 * (its subjects and grades would no longer fit), and dropping a sitting
 * that has results.
 */
async function updateExaminationNow(user: PublicUser, id: string, body: unknown): Promise<ExaminationView> {
  const input = readExamination(body);
  return getDb().transaction(async (tx) => {
    const [existing] = await loadExaminations(tx, user.id, id);
    if (!existing) throw new NotFoundError("Examination");
    ValidationError.assert(validateExamination(input, await configuration(tx), existing));
    await assertNotDuplicate(tx, user.id, input.qualification, id);

    const recorded = existing.sittings.reduce((n, s) => n + s.resultCount, 0);
    if (input.qualification !== existing.qualification && recorded > 0) {
      throw new ValidationError({ qualification: "Results have been recorded for this examination. Remove them before changing its qualification." });
    }
    const dropped = existing.sittings.slice(input.sittings.length);
    const blocked = dropped.find((s) => s.resultCount > 0);
    if (blocked) throw new ValidationError({ sittings: `Sitting ${blocked.sittingNo} has results recorded. Remove them before reducing the number of sittings.` });

    await tx.update(examinationRecords).set({ examTypeId: input.qualification, updatedAt: new Date() }).where(eq(examinationRecords.id, id));
    if (dropped.length) await tx.delete(examinationSittings).where(inArray(examinationSittings.id, dropped.map((s) => s.id)));
    for (const [i, s] of input.sittings.entries()) {
      const current = existing.sittings[i];
      if (current) await tx.update(examinationSittings).set(sittingRow(s)).where(eq(examinationSittings.id, current.id));
      else await tx.insert(examinationSittings).values({ id: newId("sit"), examinationRecordId: id, sittingNo: i + 1, ...sittingRow(s) });
    }
    const [saved] = await loadExaminations(tx, user.id, id);
    await audit(tx, { action: "update", entityType: "examination-record", entityId: id, before: existing as unknown as Record<string, unknown>, after: saved as unknown as Record<string, unknown> });
    return saved;
  });
}

/** Removes an examination, its sittings and the results recorded against them. */
async function deleteExaminationNow(user: PublicUser, id: string) {
  await getDb().transaction(async (tx) => {
    const [existing] = await loadExaminations(tx, user.id, id);
    if (!existing) throw new NotFoundError("Examination");
    await tx.delete(examinationRecords).where(and(eq(examinationRecords.id, id), eq(examinationRecords.userId, user.id)));
    await audit(tx, { action: "delete", entityType: "examination-record", entityId: id, before: existing as unknown as Record<string, unknown>, after: null });
  });
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

type ResultRow = typeof examinationResults.$inferSelect;

function toResult(row: ResultRow, examinationId: string | null, config: ExamConfiguration): ResultView {
  const type = config.get(row.examTypeId);
  return {
    id: row.id,
    sittingId: row.sittingId ?? "",
    examinationId: examinationId ?? "",
    qualification: row.examTypeId,
    subject: row.subject,
    value: row.value,
    resultTypeId: row.resultTypeId ?? "",
    result: row.resultTypeId || !type ? null : computeResult(type, row.value),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const rowInput = (row: ResultRow): ResultInput => ({ sittingId: row.sittingId ?? "", subject: row.subject, value: row.value, resultTypeId: row.resultTypeId ?? "" });

/**
 * The sitting a result is being added to, which must be one of the
 * applicant's own. Another applicant's sitting, or one that doesn't
 * exist, gets the same answer.
 */
async function ownSitting(tx: Executor, userId: string, sittingId: string) {
  if (!sittingId) throw new ValidationError({ sittingId: "Choose the examination these results are for." });
  const [row] = await tx
    .select({ id: examinationSittings.id, examinationId: examinationRecords.id, examTypeId: examinationRecords.examTypeId })
    .from(examinationSittings)
    .innerJoin(examinationRecords, eq(examinationRecords.id, examinationSittings.examinationRecordId))
    .where(and(eq(examinationSittings.id, sittingId), eq(examinationRecords.userId, userId)))
    .limit(1);
  if (!row) throw new ValidationError({ sittingId: "Choose one of the examinations you have added." });
  return row;
}

async function assertResultNotDuplicate(tx: Executor, input: ResultInput, exceptId?: string) {
  const [other] = await tx
    .select({ id: examinationResults.id })
    .from(examinationResults)
    .where(and(eq(examinationResults.sittingId, input.sittingId), eq(examinationResults.subject, input.subject)))
    .limit(1);
  if (other && other.id !== exceptId) throw new ConflictError("You've already recorded a result for this subject in this examination. Edit it instead.", { fieldErrors: { subject: "You've already recorded a result for this subject." } });
}

/** Checks a result against the qualification of the examination it belongs to. */
function assertValidResult(input: ResultInput, examTypeId: string, config: ExamConfiguration, existing?: ResultInput) {
  const type = config.get(examTypeId);
  if (!type) throw new ValidationError({ sittingId: "This examination's qualification is no longer set up, so results can't be added to it." });
  ValidationError.assert(validateResult(input, type, config, existing));
}

export async function listResults(user: PublicUser): Promise<ResultView[]> {
  const db = getDb();
  const [rows, config] = await Promise.all([
    db
      .select({ result: examinationResults, examinationId: examinationSittings.examinationRecordId })
      .from(examinationResults)
      .leftJoin(examinationSittings, eq(examinationSittings.id, examinationResults.sittingId))
      .where(eq(examinationResults.userId, user.id))
      .orderBy(asc(examinationResults.createdAt)),
    configuration(db),
  ]);
  return rows.map((r) => toResult(r.result, r.examinationId, config));
}

async function createResultNow(user: PublicUser, body: unknown): Promise<ResultView> {
  const input = readResult(body);
  return getDb().transaction(async (tx) => {
    const sitting = await ownSitting(tx, user.id, input.sittingId);
    const config = await configuration(tx);
    assertValidResult(input, sitting.examTypeId, config);
    await assertResultNotDuplicate(tx, input);
    const [row] = await tx
      .insert(examinationResults)
      .values({ id: newId("res"), userId: user.id, sittingId: sitting.id, examTypeId: sitting.examTypeId, subject: input.subject, value: input.value, resultTypeId: input.resultTypeId || null })
      .returning();
    await audit(tx, { action: "create", entityType: "examination-result", entityId: row.id, before: null, after: row });
    return toResult(row, sitting.examinationId, config);
  });
}

/** Changes a result. It can be moved to another of the applicant's examinations, and is then checked against that one's qualification. */
async function updateResultNow(user: PublicUser, id: string, body: unknown): Promise<ResultView> {
  const input = readResult(body);
  return getDb().transaction(async (tx) => {
    const own = and(eq(examinationResults.id, id), eq(examinationResults.userId, user.id));
    const [existing] = await tx.select().from(examinationResults).where(own).limit(1);
    if (!existing) throw new NotFoundError("Result");
    const sitting = await ownSitting(tx, user.id, input.sittingId);
    const config = await configuration(tx);
    assertValidResult(input, sitting.examTypeId, config, rowInput(existing));
    await assertResultNotDuplicate(tx, input, id);
    const [row] = await tx
      .update(examinationResults)
      .set({ sittingId: sitting.id, examTypeId: sitting.examTypeId, subject: input.subject, value: input.value, resultTypeId: input.resultTypeId || null, updatedAt: new Date() })
      .where(own)
      .returning();
    await audit(tx, { action: "update", entityType: "examination-result", entityId: id, before: existing, after: row });
    return toResult(row, sitting.examinationId, config);
  });
}

async function deleteResultNow(user: PublicUser, id: string) {
  await getDb().transaction(async (tx) => {
    const [deleted] = await tx
      .delete(examinationResults)
      .where(and(eq(examinationResults.id, id), eq(examinationResults.userId, user.id)))
      .returning();
    if (!deleted) throw new NotFoundError("Result");
    await audit(tx, { action: "delete", entityType: "examination-result", entityId: id, before: deleted, after: null });
  });
}

// ---------------------------------------------------------------------------
// Keeping application statuses in step
// ---------------------------------------------------------------------------

/**
 * Runs a change to a section every application shares, then re-checks the
 * applicant's applications that haven't been submitted, so each one's
 * INCOMPLETE or COMPLETED status follows (src/server/modules/applications/
 * applications.workflow.ts). That module is loaded when needed rather than
 * imported, because it reads this one.
 */
async function thenRecheck<T>(userId: string, change: Promise<T>): Promise<T> {
  const result = await change;
  const { syncApplicantCompletion } = await import("@/server/modules/applications/applications.workflow");
  await getDb().transaction((tx) => syncApplicantCompletion(tx, userId));
  return result;
}

export function createExamination(user: PublicUser, body: unknown): Promise<ExaminationView> {
  return thenRecheck(user.id, createExaminationNow(user, body));
}

export function updateExamination(user: PublicUser, id: string, body: unknown): Promise<ExaminationView> {
  return thenRecheck(user.id, updateExaminationNow(user, id, body));
}

export function deleteExamination(user: PublicUser, id: string): Promise<void> {
  return thenRecheck(user.id, deleteExaminationNow(user, id));
}

export function createResult(user: PublicUser, body: unknown): Promise<ResultView> {
  return thenRecheck(user.id, createResultNow(user, body));
}

export function updateResult(user: PublicUser, id: string, body: unknown): Promise<ResultView> {
  return thenRecheck(user.id, updateResultNow(user, id, body));
}

export function deleteResult(user: PublicUser, id: string): Promise<void> {
  return thenRecheck(user.id, deleteResultNow(user, id));
}
