import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { buildExamConfigurationData, computeResult, EXAM_PARAM_CATEGORIES, toExamConfiguration, type ExamConfiguration, type ExamConfigurationData, type ExamParam } from "@/lib/examination/config";
import { validateExamination, validateResult, type ExaminationInput, type ResultInput } from "@/lib/examination/validation";
import { getDb, type Executor } from "@/server/db/client";
import { examinationRecords, examinationResults, examinationSittingSubjects, examinationSittings, parameters } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";

/**
 * Examinations and results: the configuration the forms are built from,
 * and each applicant's own records. Every function that takes the
 * signed-in user only ever touches that user's rows, and every save is
 * checked against the configuration in the database, whatever the client
 * sent.
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

function readExamination(body: unknown): ExaminationInput {
  const input = asObject(body);
  const sittings = Array.isArray(input.sittings) ? input.sittings.slice(0, 20) : [];
  return {
    qualification: str(input.qualification),
    sittings: sittings.map((raw) => {
      const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const entries = Array.isArray(s.subjectEntries) ? s.subjectEntries.slice(0, 60) : [];
      return {
        examinationYear: str(s.examinationYear),
        candidateNumber: str(s.candidateNumber),
        centreNumber: str(s.centreNumber),
        subjectEntries: entries
          .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>) : {}))
          .map((e) => ({ subject: str(e.subject), value: str(e.value) }))
          // A row the applicant added and left untouched isn't an entry.
          .filter((e) => e.subject || e.value),
      };
    }),
  };
}

function readResult(body: unknown): ResultInput {
  const input = asObject(body);
  const resultTypeId = str(input.resultTypeId);
  return { qualification: str(input.qualification), subject: str(input.subject), value: resultTypeId ? "" : str(input.value), resultTypeId };
}

// ---------------------------------------------------------------------------
// Examination records
// ---------------------------------------------------------------------------

export interface ExaminationRecordView extends ExaminationInput {
  id: string;
  sittings: (ExaminationInput["sittings"][number] & { id: string; subjectEntries: { id: string; subject: string; value: string }[] })[];
  createdAt: string;
  updatedAt: string;
}

async function loadExaminations(db: Executor, userId: string, onlyId?: string): Promise<ExaminationRecordView[]> {
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
  const subjects = sittings.length
    ? await db
        .select()
        .from(examinationSittingSubjects)
        .where(inArray(examinationSittingSubjects.sittingId, sittings.map((s) => s.id)))
        .orderBy(asc(examinationSittingSubjects.position))
    : [];

  return records.map((r) => ({
    id: r.id,
    qualification: r.examTypeId,
    sittings: sittings
      .filter((s) => s.examinationRecordId === r.id)
      .map((s) => ({
        id: s.id,
        examinationYear: String(s.year),
        candidateNumber: s.candidateNumber,
        centreNumber: s.centreNumber,
        subjectEntries: subjects.filter((e) => e.sittingId === s.id).map((e) => ({ id: e.id, subject: e.subject, value: e.value })),
      })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

async function writeSittings(tx: Executor, recordId: string, input: ExaminationInput) {
  for (const [i, s] of input.sittings.entries()) {
    const sittingId = newId("sit");
    await tx.insert(examinationSittings).values({ id: sittingId, examinationRecordId: recordId, sittingNo: i + 1, year: Number(s.examinationYear), candidateNumber: s.candidateNumber, centreNumber: s.centreNumber });
    if (s.subjectEntries.length) {
      await tx.insert(examinationSittingSubjects).values(s.subjectEntries.map((e, j) => ({ id: newId("sub"), sittingId, subject: e.subject, value: e.value, position: j })));
    }
  }
}

async function assertNotDuplicate(tx: Executor, userId: string, qualification: string, exceptId?: string) {
  const [other] = await tx
    .select({ id: examinationRecords.id })
    .from(examinationRecords)
    .where(and(eq(examinationRecords.userId, userId), eq(examinationRecords.examTypeId, qualification)))
    .limit(1);
  if (other && other.id !== exceptId) throw new ConflictError("You've already added this examination. Edit it to change its sittings.", { fieldErrors: { qualification: "You've already added this examination." } });
}

export function listExaminations(user: PublicUser): Promise<ExaminationRecordView[]> {
  return loadExaminations(getDb(), user.id);
}

export async function getExamination(user: PublicUser, id: string): Promise<ExaminationRecordView> {
  const [record] = await loadExaminations(getDb(), user.id, id);
  if (!record) throw new NotFoundError("Examination");
  return record;
}

export async function createExamination(user: PublicUser, body: unknown): Promise<ExaminationRecordView> {
  const input = readExamination(body);
  return getDb().transaction(async (tx) => {
    ValidationError.assert(validateExamination(input, await configuration(tx)));
    await assertNotDuplicate(tx, user.id, input.qualification);
    const id = newId("exm");
    await tx.insert(examinationRecords).values({ id, userId: user.id, examTypeId: input.qualification });
    await writeSittings(tx, id, input);
    const [saved] = await loadExaminations(tx, user.id, id);
    await audit(tx, { action: "create", entityType: "examination-record", entityId: id, before: null, after: saved as unknown as Record<string, unknown> });
    return saved;
  });
}

/** Replaces the record's qualification and sittings with what was sent. */
export async function updateExamination(user: PublicUser, id: string, body: unknown): Promise<ExaminationRecordView> {
  const input = readExamination(body);
  return getDb().transaction(async (tx) => {
    const [existing] = await loadExaminations(tx, user.id, id);
    if (!existing) throw new NotFoundError("Examination");
    ValidationError.assert(validateExamination(input, await configuration(tx), existing));
    await assertNotDuplicate(tx, user.id, input.qualification, id);

    await tx.update(examinationRecords).set({ examTypeId: input.qualification, updatedAt: new Date() }).where(eq(examinationRecords.id, id));
    await tx.delete(examinationSittings).where(eq(examinationSittings.examinationRecordId, id));
    await writeSittings(tx, id, input);
    const [saved] = await loadExaminations(tx, user.id, id);
    await audit(tx, { action: "update", entityType: "examination-record", entityId: id, before: existing as unknown as Record<string, unknown>, after: saved as unknown as Record<string, unknown> });
    return saved;
  });
}

export async function deleteExamination(user: PublicUser, id: string) {
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

export interface ResultView extends ResultInput {
  id: string;
  /** Worked out from the grade or score; null for a result recorded without one, or if the qualification no longer exists. */
  result: "Pass" | "Fail" | null;
  createdAt: string;
  updatedAt: string;
}

type ResultRow = typeof examinationResults.$inferSelect;

function toResult(row: ResultRow, config: ExamConfiguration): ResultView {
  const type = config.get(row.examTypeId);
  return {
    id: row.id,
    qualification: row.examTypeId,
    subject: row.subject,
    value: row.value,
    resultTypeId: row.resultTypeId ?? "",
    result: row.resultTypeId || !type ? null : computeResult(type, row.value),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const rowInput = (row: ResultRow): ResultInput => ({ qualification: row.examTypeId, subject: row.subject, value: row.value, resultTypeId: row.resultTypeId ?? "" });

async function assertResultNotDuplicate(tx: Executor, userId: string, input: ResultInput, exceptId?: string) {
  const [other] = await tx
    .select({ id: examinationResults.id })
    .from(examinationResults)
    .where(and(eq(examinationResults.userId, userId), eq(examinationResults.examTypeId, input.qualification), eq(examinationResults.subject, input.subject)))
    .limit(1);
  if (other && other.id !== exceptId) throw new ConflictError("You've already recorded a result for this subject. Edit it instead.", { fieldErrors: { subject: "You've already recorded a result for this subject." } });
}

export async function listResults(user: PublicUser): Promise<ResultView[]> {
  const db = getDb();
  const [rows, config] = await Promise.all([db.select().from(examinationResults).where(eq(examinationResults.userId, user.id)).orderBy(asc(examinationResults.createdAt)), configuration(db)]);
  return rows.map((r) => toResult(r, config));
}

export async function createResult(user: PublicUser, body: unknown): Promise<ResultView> {
  const input = readResult(body);
  return getDb().transaction(async (tx) => {
    const config = await configuration(tx);
    ValidationError.assert(validateResult(input, config));
    await assertResultNotDuplicate(tx, user.id, input);
    const [row] = await tx
      .insert(examinationResults)
      .values({ id: newId("res"), userId: user.id, examTypeId: input.qualification, subject: input.subject, value: input.value, resultTypeId: input.resultTypeId || null })
      .returning();
    await audit(tx, { action: "create", entityType: "examination-result", entityId: row.id, before: null, after: row });
    return toResult(row, config);
  });
}

export async function updateResult(user: PublicUser, id: string, body: unknown): Promise<ResultView> {
  const input = readResult(body);
  return getDb().transaction(async (tx) => {
    const own = and(eq(examinationResults.id, id), eq(examinationResults.userId, user.id));
    const [existing] = await tx.select().from(examinationResults).where(own).limit(1);
    if (!existing) throw new NotFoundError("Result");
    const config = await configuration(tx);
    ValidationError.assert(validateResult(input, config, rowInput(existing)));
    await assertResultNotDuplicate(tx, user.id, input, id);
    const [row] = await tx
      .update(examinationResults)
      .set({ examTypeId: input.qualification, subject: input.subject, value: input.value, resultTypeId: input.resultTypeId || null, updatedAt: new Date() })
      .where(own)
      .returning();
    await audit(tx, { action: "update", entityType: "examination-result", entityId: id, before: existing, after: row });
    return toResult(row, config);
  });
}

export async function deleteResult(user: PublicUser, id: string) {
  await getDb().transaction(async (tx) => {
    const [deleted] = await tx
      .delete(examinationResults)
      .where(and(eq(examinationResults.id, id), eq(examinationResults.userId, user.id)))
      .returning();
    if (!deleted) throw new NotFoundError("Result");
    await audit(tx, { action: "delete", entityType: "examination-result", entityId: id, before: deleted, after: null });
  });
}
