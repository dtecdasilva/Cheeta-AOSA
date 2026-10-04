import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { demographicCompletion, type DemographicCompletion } from "@/lib/demographic/completion";
import { EMPTY_DEMOGRAPHIC_PROFILE, type DemographicProfile } from "@/lib/demographic/types";
import { validateDemographicForSave, validateDemographicForSubmit, type DemographicField } from "@/lib/demographic/validation";
import type { EducationLevelConfig } from "@/lib/education/configTypes";
import type { EducationRecord, EducationRecordInput } from "@/lib/education/types";
import { validateEducationRecord } from "@/lib/education/validation";
import { getDb, type Executor } from "@/server/db/client";
import { demographicProfiles, educationLevels, educationQualifications, educationRecords } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { offeredCountries } from "@/server/modules/reference/countries.service";

/**
 * The applicant's shared sections: demographic information and education
 * history. Validation is the frontend's own validators (src/lib/demographic,
 * src/lib/education), so the form and the API can never disagree; this
 * service adds persistence, ownership and the completion status.
 * Every function takes the signed-in user and only ever touches their rows.
 */

// ---------------------------------------------------------------------------
// Demographic
// ---------------------------------------------------------------------------

const DEMOGRAPHIC_FIELDS = Object.keys(EMPTY_DEMOGRAPHIC_PROFILE) as DemographicField[];

type DemographicRow = typeof demographicProfiles.$inferSelect;
type SaveMode = "save" | "submit";

/** The stored record as the API returns it: the fields, whether anything is stored yet, and how complete it is. */
export interface DemographicRecord {
  profile: DemographicProfile;
  exists: boolean;
  completion: DemographicCompletion;
}

function toProfile(row: DemographicRow | undefined): DemographicProfile {
  const profile = { ...EMPTY_DEMOGRAPHIC_PROFILE, updatedAt: "" } as DemographicProfile;
  if (!row) return profile;
  for (const k of DEMOGRAPHIC_FIELDS) profile[k] = row[k] ?? "";
  profile.updatedAt = row.updatedAt.toISOString();
  return profile;
}

function toDemographicRecord(row: DemographicRow | undefined): DemographicRecord {
  const profile = toProfile(row);
  return { profile, exists: !!row, completion: demographicCompletion(row ? profile : null, row?.submittedAt?.toISOString() ?? null) };
}

async function loadRow(db: Executor, userId: string): Promise<DemographicRow | undefined> {
  const [row] = await db.select().from(demographicProfiles).where(eq(demographicProfiles.userId, userId)).limit(1);
  return row;
}

/**
 * Reads the demographic fields out of a request body. Unknown keys are
 * ignored; email and telephone are never taken from the request, because
 * they belong to the account. A known field sent as anything other than
 * text is reported rather than silently dropped.
 */
function readInput(body: unknown): { patch: Partial<Record<DemographicField, string>>; mode: SaveMode } {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestError("Send the demographic fields as a JSON object.");
  const input = body as Record<string, unknown>;
  if (input.mode !== undefined && input.mode !== "save" && input.mode !== "submit") throw new ValidationError({ mode: 'Use "save" for a draft or "submit" to complete the section.' });

  const patch: Partial<Record<DemographicField, string>> = {};
  const wrongType: Record<string, string> = {};
  for (const k of DEMOGRAPHIC_FIELDS) {
    if (!(k in input)) continue;
    const value = input[k];
    if (typeof value === "string") patch[k] = value.trim();
    else if (value === null) patch[k] = "";
    else wrongType[k] = "Enter this as text.";
  }
  ValidationError.assert(wrongType);
  return { patch, mode: input.mode === "submit" ? "submit" : "save" };
}

/**
 * Applies a change to the stored record and says what is wrong with the
 * result, without saving anything.
 *
 * A draft ("save") only has to be well-formed. Submitting, and any change
 * to a section that has already been submitted, has to leave every
 * required field filled in: once a section counts as complete it can't be
 * edited back into an incomplete one.
 */
async function applyChange(db: Executor, row: DemographicRow | undefined, patch: Partial<Record<DemographicField, string>>, mode: SaveMode) {
  const current = toProfile(row);
  // The countries on offer today, plus any this record already holds.
  const countryLists = await offeredCountries(db, [current.countryOfBirth, current.countryOfResidence, current.nationality, current.parentsCountry]);
  const merged: DemographicProfile = { ...current, ...patch };
  // The description only means something alongside a "Yes".
  if (merged.disability !== "Yes") merged.disabilityDetails = "";

  const alreadySubmitted = !!row?.submittedAt;
  const strict = mode === "submit" || alreadySubmitted;
  const options = { countries: countryLists };
  const fieldErrors = (strict ? validateDemographicForSubmit(merged, options) : validateDemographicForSave(merged, options)) as Record<string, string | undefined>;
  const found = Object.fromEntries(Object.entries(fieldErrors).filter(([, v]) => v)) as Record<string, string>;
  return { current, merged, fieldErrors: found, alreadySubmitted, strict };
}

/** Retrieve: the applicant's own record (empty fields if nothing is saved yet) and its completion status. */
export async function getDemographicRecord(user: PublicUser): Promise<DemographicRecord> {
  return toDemographicRecord(await loadRow(getDb(), user.id));
}

/** Completion status on its own, for screens that only need to know how far along the section is. */
export async function getDemographicCompletion(user: PublicUser): Promise<{ exists: boolean; completion: DemographicCompletion }> {
  const { exists, completion } = await getDemographicRecord(user);
  return { exists, completion };
}

/**
 * Validation as a dry run: what saving or submitting this would report,
 * and what the completion status would become. Nothing is written.
 */
export async function validateDemographic(user: PublicUser, body: unknown) {
  const { patch, mode } = readInput(body);
  const row = await loadRow(getDb(), user.id);
  const { merged, fieldErrors } = await applyChange(getDb(), row, patch, mode);
  const valid = Object.keys(fieldErrors).length === 0;
  const submittedAt = mode === "submit" && valid ? new Date().toISOString() : (row?.submittedAt?.toISOString() ?? null);
  return { valid, mode, fieldErrors, completion: demographicCompletion(merged, submittedAt) };
}

async function writeDemographic(user: PublicUser, body: unknown, kind: "create" | "update"): Promise<DemographicRecord> {
  const { patch, mode } = readInput(body);
  return getDb().transaction(async (tx) => {
    const row = await loadRow(tx, user.id);
    if (kind === "create" && row) throw new ConflictError("Your demographic information already exists. Update it instead.");
    if (kind === "update" && !row) throw new NotFoundError("Demographic information");

    const { current, merged, fieldErrors, alreadySubmitted, strict } = await applyChange(tx, row, patch, mode);
    if (Object.keys(fieldErrors).length) {
      throw new ValidationError(fieldErrors, strict && mode === "save" && alreadySubmitted ? "This section has already been submitted, so its required fields must stay filled in." : undefined);
    }

    const values = Object.fromEntries(DEMOGRAPHIC_FIELDS.map((k) => [k, merged[k] ?? ""])) as Record<DemographicField, string>;
    const submitting = mode === "submit";
    const [saved] = row
      ? await tx
          .update(demographicProfiles)
          .set({ ...values, updatedAt: new Date(), ...(submitting ? { submittedAt: new Date() } : {}) })
          .where(eq(demographicProfiles.userId, user.id))
          .returning()
      : await tx
          .insert(demographicProfiles)
          .values({ userId: user.id, ...values, ...(submitting ? { submittedAt: new Date() } : {}) })
          .returning();

    await audit(tx, {
      action: submitting ? "submit" : kind,
      entityType: "demographic-profile",
      entityId: user.id,
      before: row ? (current as unknown as Record<string, unknown>) : null,
      after: merged as unknown as Record<string, unknown>,
    });
    return toDemographicRecord(saved);
  });
}

/** Create: the first save. Refused with 409 if the applicant already has a record. */
export function createDemographic(user: PublicUser, body: unknown): Promise<DemographicRecord> {
  return writeDemographic(user, body, "create");
}

/** Update: changes only the fields sent. Refused with 404 if there is nothing to update yet. */
export function updateDemographic(user: PublicUser, body: unknown): Promise<DemographicRecord> {
  return writeDemographic(user, body, "update");
}

// ---------------------------------------------------------------------------
// Education levels (configuration) and records
// ---------------------------------------------------------------------------

export async function listEducationLevels(): Promise<EducationLevelConfig[]> {
  const db = getDb();
  const [levels, quals] = await Promise.all([
    db.select().from(educationLevels).orderBy(asc(educationLevels.sortOrder)),
    db.select().from(educationQualifications).orderBy(asc(educationQualifications.label)),
  ]);
  return levels.map((l) => ({
    id: l.id,
    name: l.name,
    order: l.sortOrder,
    qualifications: quals.filter((q) => q.educationLevelId === l.id).map((q) => ({ id: q.id, label: q.label })),
  }));
}

function toRecord(row: typeof educationRecords.$inferSelect): EducationRecord {
  return {
    id: row.id,
    startYear: row.startYear,
    endYear: row.endYear,
    schoolName: row.schoolName,
    schoolType: row.schoolType,
    qualification: row.qualification,
    country: row.country,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function validInput(body: Record<string, unknown>, existing?: { country: string }): Promise<EducationRecordInput> {
  const input: Partial<EducationRecordInput> = {
    startYear: typeof body.startYear === "string" ? body.startYear.trim() : String(body.startYear ?? ""),
    endYear: typeof body.endYear === "string" ? body.endYear.trim() : String(body.endYear ?? ""),
    schoolName: typeof body.schoolName === "string" ? body.schoolName.trim() : "",
    country: typeof body.country === "string" ? body.country : "",
    schoolType: typeof body.schoolType === "string" ? body.schoolType : "",
    qualification: typeof body.qualification === "string" ? body.qualification : "",
  };
  // The countries on offer today, plus the one this record already holds.
  const countries = await offeredCountries(getDb(), [existing?.country]);
  ValidationError.assert(validateEducationRecord(input, await listEducationLevels(), countries.all));
  return input as EducationRecordInput;
}

export async function listEducation(user: PublicUser): Promise<EducationRecord[]> {
  const rows = await getDb().select().from(educationRecords).where(eq(educationRecords.userId, user.id)).orderBy(asc(educationRecords.startYear), asc(educationRecords.createdAt));
  return rows.map(toRecord);
}

export async function createEducation(user: PublicUser, body: Record<string, unknown>): Promise<EducationRecord> {
  const input = await validInput(body);
  const row = await getDb().transaction(async (tx) => {
    const [inserted] = await tx.insert(educationRecords).values({ id: newId("edu"), userId: user.id, ...input }).returning();
    await audit(tx, { action: "create", entityType: "education-record", entityId: inserted.id, before: null, after: inserted });
    return inserted;
  });
  return toRecord(row);
}

export async function updateEducation(user: PublicUser, id: string, body: Record<string, unknown>): Promise<EducationRecord> {
  const ownRow = and(eq(educationRecords.id, id), eq(educationRecords.userId, user.id));
  const [current] = await getDb().select({ country: educationRecords.country }).from(educationRecords).where(ownRow).limit(1);
  if (!current) throw new NotFoundError("Education record");
  const input = await validInput(body, current);
  const row = await getDb().transaction(async (tx) => {
    const [existing] = await tx.select().from(educationRecords).where(ownRow).limit(1);
    if (!existing) throw new NotFoundError("Education record");
    const [updated] = await tx.update(educationRecords).set(input).where(ownRow).returning();
    await audit(tx, { action: "update", entityType: "education-record", entityId: id, before: existing, after: updated });
    return updated;
  });
  return toRecord(row);
}

export async function deleteEducation(user: PublicUser, id: string) {
  await getDb().transaction(async (tx) => {
    const [deleted] = await tx
      .delete(educationRecords)
      .where(and(eq(educationRecords.id, id), eq(educationRecords.userId, user.id)))
      .returning();
    if (!deleted) throw new NotFoundError("Education record");
    await audit(tx, { action: "delete", entityType: "education-record", entityId: id, before: deleted, after: null });
  });
}
