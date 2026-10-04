import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { EMPTY_DEMOGRAPHIC_PROFILE, type DemographicProfile } from "@/lib/demographic/types";
import { validateDemographicForSave, validateDemographicForSubmit } from "@/lib/demographic/validation";
import type { EducationLevelConfig } from "@/lib/education/configTypes";
import type { EducationRecord, EducationRecordInput } from "@/lib/education/types";
import { validateEducationRecord } from "@/lib/education/validation";
import { getDb } from "@/server/db/client";
import { demographicProfiles, educationLevels, educationQualifications, educationRecords } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { NotFoundError, ValidationError } from "@/server/http/errors";

/**
 * The applicant's shared sections: demographic information and education
 * history. Validation is the frontend's own validators (src/lib/demographic,
 * src/lib/education); this service only adds persistence and ownership.
 * Every function takes the signed-in user and only ever touches their rows.
 */

// ---------------------------------------------------------------------------
// Demographic
// ---------------------------------------------------------------------------

const DEMOGRAPHIC_FIELDS = Object.keys(EMPTY_DEMOGRAPHIC_PROFILE) as (keyof typeof EMPTY_DEMOGRAPHIC_PROFILE)[];

function pickDemographic(input: Record<string, unknown>): Partial<DemographicProfile> {
  const out: Partial<DemographicProfile> = {};
  for (const k of DEMOGRAPHIC_FIELDS) if (typeof input[k] === "string") out[k] = (input[k] as string).trim();
  return out;
}

export async function getDemographic(user: PublicUser): Promise<DemographicProfile> {
  const [row] = await getDb().select().from(demographicProfiles).where(eq(demographicProfiles.userId, user.id)).limit(1);
  if (!row) return { ...EMPTY_DEMOGRAPHIC_PROFILE, updatedAt: "" };
  const profile = { ...EMPTY_DEMOGRAPHIC_PROFILE } as DemographicProfile;
  for (const k of DEMOGRAPHIC_FIELDS) profile[k] = row[k] ?? "";
  profile.updatedAt = row.updatedAt.toISOString();
  return profile;
}

/**
 * Saves a draft (`mode: "save"`, lenient) or submits the section
 * (`mode: "submit"`, every required field). Email and telephone are never
 * taken from the request: they belong to the account.
 */
export async function saveDemographic(user: PublicUser, body: Record<string, unknown>): Promise<DemographicProfile> {
  const patch = pickDemographic(body);
  const current = await getDemographic(user);
  const merged = { ...current, ...patch };
  const submitting = body.mode === "submit";
  // Validate the merged record when submitting, so fields saved earlier count.
  ValidationError.assert(submitting ? validateDemographicForSubmit(merged) : validateDemographicForSave(patch));

  const values = Object.fromEntries(DEMOGRAPHIC_FIELDS.map((k) => [k, merged[k] ?? ""])) as Record<(typeof DEMOGRAPHIC_FIELDS)[number], string>;
  await getDb().transaction(async (tx) => {
    await tx
      .insert(demographicProfiles)
      .values({ userId: user.id, ...values, ...(submitting ? { submittedAt: new Date() } : {}) })
      .onConflictDoUpdate({ target: demographicProfiles.userId, set: { ...values, updatedAt: new Date(), ...(submitting ? { submittedAt: new Date() } : {}) } });
    await audit(tx, { action: submitting ? "submit" : "update", entityType: "demographic-profile", entityId: user.id, before: current as unknown as Record<string, unknown>, after: merged as unknown as Record<string, unknown> });
  });
  return getDemographic(user);
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

async function validInput(body: Record<string, unknown>): Promise<EducationRecordInput> {
  const input: Partial<EducationRecordInput> = {
    startYear: typeof body.startYear === "string" ? body.startYear.trim() : String(body.startYear ?? ""),
    endYear: typeof body.endYear === "string" ? body.endYear.trim() : String(body.endYear ?? ""),
    schoolName: typeof body.schoolName === "string" ? body.schoolName.trim() : "",
    country: typeof body.country === "string" ? body.country : "",
    schoolType: typeof body.schoolType === "string" ? body.schoolType : "",
    qualification: typeof body.qualification === "string" ? body.qualification : "",
  };
  ValidationError.assert(validateEducationRecord(input, await listEducationLevels()));
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
  const input = await validInput(body);
  const row = await getDb().transaction(async (tx) => {
    const ownRow = and(eq(educationRecords.id, id), eq(educationRecords.userId, user.id));
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
