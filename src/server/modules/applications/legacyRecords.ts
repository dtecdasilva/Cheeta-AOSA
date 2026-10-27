import "server-only";
import { and, asc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import { nextCounter } from "@/server/db/ids";
import { documentTypeMaxKb, normaliseFileType, supportedFileTypes } from "@/lib/institution/uploadRequirements";
import type { Executor } from "@/server/db/client";
import { admissions, applicationDocuments, applicationInstitutions, applications, feePayments, parameters, uploadRequirements } from "@/server/db/schema";
import { logger } from "@/server/logging/logger";

/**
 * Brings records written by earlier versions up to what the current one
 * stores. Runs at every start-up, after migrations; each step only
 * touches rows that still need it, so it does nothing once done.
 *
 * - Documents get their owners written onto them (applicant, application,
 *   institution), copied from the application they were uploaded to, and
 *   their document type from the requirement they answer.
 * - Upload requirements entered as free text are matched to a document
 *   type from the platform's "Upload types" list where the name says which
 *   one it is.
 * - Rejected payments get their reason moved out of the general note into
 *   its own field.
 * - Applications submitted before Application IDs existed are given one.
 */

/** Names the sample requirements were entered under, and the upload type each one is. */
const KNOWN_NAMES: Record<string, string> = {
  "passport photo": "PHOTO",
  "baccalaureate certificate": "BAC",
  "transcript of records": "TRANS",
  "previous report card": "TRANS",
  "level certificate": "GCE-AL",
  "medical fitness certificate": "MED",
};

/** The upload type a requirement's name refers to: one with that very name, or one it is known by. */
export function documentTypeForName<T extends { id: string; code: string; label: string }>(name: string, types: T[]): T | null {
  const wanted = name.trim().toLowerCase();
  return types.find((t) => t.label.trim().toLowerCase() === wanted) ?? types.find((t) => t.code === KNOWN_NAMES[wanted]) ?? null;
}

async function adoptRequirementTypes(db: Executor): Promise<number> {
  const untyped = await db.select().from(uploadRequirements).where(isNull(uploadRequirements.documentTypeId));
  if (!untyped.length) return 0;
  const [types, typed] = await Promise.all([
    db.select({ id: parameters.id, code: parameters.code, label: parameters.label, attrs: parameters.attrs }).from(parameters).where(eq(parameters.category, "upload-types")),
    db.select({ institutionId: uploadRequirements.institutionId, documentTypeId: uploadRequirements.documentTypeId }).from(uploadRequirements),
  ]);
  // An institution asks for each type once, so a second requirement that would land on the same type is left as it is.
  const taken = new Set(typed.filter((t) => t.documentTypeId).map((t) => `${t.institutionId}\n${t.documentTypeId}`));
  let adopted = 0;
  for (const requirement of untyped) {
    const type = documentTypeForName(requirement.name, types);
    if (!type || taken.has(`${requirement.institutionId}\n${type.id}`)) continue;
    taken.add(`${requirement.institutionId}\n${type.id}`);
    // Kept within what the type allows, where the two overlap at all.
    const allowed = supportedFileTypes(type.attrs?.formats) as string[];
    const fileTypes = [...new Set(requirement.fileTypes.map(normaliseFileType))].filter((f) => allowed.includes(f));
    await db
      .update(uploadRequirements)
      .set({ documentTypeId: type.id, name: type.label, fileTypes: fileTypes.length ? fileTypes : allowed.length ? allowed : requirement.fileTypes, maxSizeKb: Math.min(requirement.maxSizeKb, documentTypeMaxKb(type.attrs?.maxSizeMb, requirement.maxSizeKb)) })
      .where(and(eq(uploadRequirements.id, requirement.id), isNull(uploadRequirements.documentTypeId)));
    adopted++;
  }
  return adopted;
}

export async function adoptLegacyRecords(db: Executor) {
  const requirements = await adoptRequirementTypes(db);

  const owners = await db
    .update(applicationDocuments)
    .set({ applicantId: applications.applicantId, applicationId: applicationInstitutions.applicationId, institutionId: applicationInstitutions.institutionId })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .where(and(eq(applicationDocuments.applicationInstitutionId, applicationInstitutions.id), isNull(applicationDocuments.applicantId)))
    .returning({ id: applicationDocuments.id });

  const typed = await db
    .update(applicationDocuments)
    .set({ documentTypeId: uploadRequirements.documentTypeId })
    .from(uploadRequirements)
    .where(and(eq(applicationDocuments.requirementId, uploadRequirements.id), isNull(applicationDocuments.documentTypeId), sql`${uploadRequirements.documentTypeId} is not null`))
    .returning({ id: applicationDocuments.id });

  const reasons = await db
    .update(feePayments)
    .set({ rejectionReason: feePayments.note, note: "" })
    .where(and(eq(feePayments.approval, "REJECTED"), isNull(feePayments.rejectionReason), sql`${feePayments.note} <> ''`))
    .returning({ id: feePayments.id });

  // Applications submitted before Application IDs were issued get one now, in the order they were submitted.
  const unnumbered = await db
    .select({ id: applicationInstitutions.id, submittedAt: applicationInstitutions.submittedAt, createdAt: applicationInstitutions.createdAt })
    .from(applicationInstitutions)
    .where(and(isNull(applicationInstitutions.applicationNumber), notInArray(applicationInstitutions.status, EDITABLE_STATUSES)))
    .orderBy(asc(applicationInstitutions.submittedAt), asc(applicationInstitutions.createdAt));
  for (const app of unnumbered) {
    const year = (app.submittedAt ?? app.createdAt).getUTCFullYear();
    const applicationNumber = `AOSA-${year}-${String(await nextCounter(db, `application-number:${year}`)).padStart(6, "0")}`;
    await db.update(applicationInstitutions).set({ applicationNumber }).where(eq(applicationInstitutions.id, app.id));
  }

  // Admissions recorded before the institution was kept on them.
  const admitted = await db
    .update(admissions)
    .set({ institutionId: applicationInstitutions.institutionId })
    .from(applicationInstitutions)
    .where(and(eq(admissions.applicationInstitutionId, applicationInstitutions.id), isNull(admissions.institutionId)))
    .returning({ id: admissions.id });

  if (admitted.length || requirements || owners.length || typed.length || reasons.length || unnumbered.length) {
    logger.child({ module: "bootstrap" }).info("Earlier records brought up to date", { uploadRequirements: requirements, documentOwners: owners.length, documentTypes: typed.length, rejectionReasons: reasons.length, applicationNumbers: unnumbered.length, admissionInstitutions: admitted.length });
  }
}
