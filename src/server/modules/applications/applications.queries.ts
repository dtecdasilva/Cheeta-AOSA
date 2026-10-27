import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { applicantFeeCategory, assessFee, type FeeAssessment } from "@/server/modules/fees/calculation";
import {
  applicationComments,
  applicationDocuments,
  applicationFees,
  applicationInstitutions,
  applicationStatusEvents,
  applications,
  departments,
  faculties,
  feePayments,
  institutions,
  parameters,
  programChoices,
  programs,
  uploadRequirements,
  users,
} from "@/server/db/schema";
import { NotFoundError } from "@/server/http/errors";

/**
 * Reads shared by the student, institution and admin application services.
 */

/** The academic year marked current (Application parameters → Academic years). */
export async function currentAcademicYear(db: Executor) {
  const [row] = await db
    .select()
    .from(parameters)
    .where(and(eq(parameters.category, "academic-years"), eq(parameters.status, "ACTIVE"), sql`${parameters.attrs}->>'current' = 'true'`))
    .limit(1);
  return row ?? null;
}

/**
 * Works out what one application to one institution costs and stores it
 * on that application (application_fees), replacing any earlier figure.
 * Called when the institution is added and again when a payment is
 * recorded, so the stored fee is always the one the applicant is asked to
 * pay. It is today's figure, at today's exchange rate where the
 * institution's fee is in another currency; the figures that become
 * permanent are the ones stored on the payment.
 *
 * `webFee` is the institution's own web fee, or null to use the platform's.
 * If the fee can't be priced (no exchange rate for its currency), nothing
 * is stored and the assessment says why.
 */
export async function assessApplicationFee(db: Executor, app: { id: string; institutionId: string; webFee: number | null }): Promise<FeeAssessment> {
  const [owner] = await db.select({ userId: applications.applicantId }).from(applicationInstitutions).innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId)).where(eq(applicationInstitutions.id, app.id)).limit(1);
  const category = owner ? await applicantFeeCategory(db, owner.userId) : "national";
  const assessment = await assessFee(db, { id: app.institutionId, webFee: app.webFee }, new Date(), category);
  if (!assessment.priced) {
    await db.delete(applicationFees).where(eq(applicationFees.applicationInstitutionId, app.id));
    return assessment;
  }
  const converted = assessment.feeRate.derivation !== null;
  const row = {
    feeConfigId: assessment.fee.feeConfigId,
    applicationFee: assessment.applicationFee,
    webFee: assessment.webFee,
    amount: assessment.amount,
    currency: assessment.currency,
    feeCurrency: assessment.fee.currency,
    feeAmount: converted ? assessment.fee.amount : null,
    feeRate: converted ? assessment.feeRate.rate : null,
    assessedAt: new Date(),
  };
  await db
    .insert(applicationFees)
    .values({ applicationInstitutionId: app.id, ...row })
    .onConflictDoUpdate({ target: applicationFees.applicationInstitutionId, set: row });
  return assessment;
}

/** How many programs an applicant may rank at this institution, from its institution type. */
export async function maxProgramChoicesFor(db: Executor, institutionId: string): Promise<number> {
  const [row] = await db
    .select({ attrs: parameters.attrs })
    .from(institutions)
    .innerJoin(parameters, eq(parameters.id, institutions.typeId))
    .where(eq(institutions.id, institutionId))
    .limit(1);
  const n = Number(row?.attrs?.maxProgramChoices);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3) : 3;
}

export type ApplicationInstitutionRow = typeof applicationInstitutions.$inferSelect;

/** One institution application with everything attached to it. */
export async function loadApplicationInstitution(db: Executor, id: string) {
  const [row] = await db
    .select({ ai: applicationInstitutions, app: applications, institution: { id: institutions.id, name: institutions.name, webFee: institutions.webFee, status: institutions.status } })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .where(eq(applicationInstitutions.id, id))
    .limit(1);
  if (!row) throw new NotFoundError("Application");

  const [choices, documents, payments, events, requirements, comments] = await Promise.all([
    // Each choice with the path down to it (faculty, department, qualification), so it can be shown without another lookup.
    db
      .select({
        id: programChoices.id,
        rank: programChoices.rank,
        programId: programs.id,
        programName: programs.name,
        programCode: programs.code,
        facultyId: faculties.id,
        faculty: faculties.name,
        departmentId: departments.id,
        department: departments.name,
        qualification: parameters.label,
      })
      .from(programChoices)
      .innerJoin(programs, eq(programs.id, programChoices.programId))
      .innerJoin(faculties, eq(faculties.id, programs.facultyId))
      .innerJoin(departments, eq(departments.id, programs.departmentId))
      .innerJoin(parameters, eq(parameters.id, programs.qualificationId))
      .where(eq(programChoices.applicationInstitutionId, id))
      .orderBy(asc(programChoices.rank)),
    db.select().from(applicationDocuments).where(eq(applicationDocuments.applicationInstitutionId, id)).orderBy(asc(applicationDocuments.createdAt)),
    db.select().from(feePayments).where(eq(feePayments.applicationInstitutionId, id)).orderBy(desc(feePayments.submittedAt)),
    db.select().from(applicationStatusEvents).where(eq(applicationStatusEvents.applicationInstitutionId, id)).orderBy(asc(applicationStatusEvents.at)),
    db
      .select()
      .from(uploadRequirements)
      .where(and(eq(uploadRequirements.institutionId, row.ai.institutionId), eq(uploadRequirements.status, "ACTIVE")))
      .orderBy(asc(uploadRequirements.name)),
    db
      .select({ comment: applicationComments, authorName: users.fullName })
      .from(applicationComments)
      .innerJoin(users, eq(users.id, applicationComments.authorUserId))
      .where(eq(applicationComments.applicationInstitutionId, id))
      .orderBy(asc(applicationComments.createdAt)),
  ]);

  return { ...row.ai, application: row.app, institution: row.institution, choices, documents, payments, events, requirements, comments: comments.map((c) => ({ ...c.comment, authorName: c.authorName })) };
}

export type LoadedApplication = Awaited<ReturnType<typeof loadApplicationInstitution>>;

/** Institution applications in a bundle, with institution names. */
export async function listBundleInstitutions(db: Executor, applicationIds: string[]) {
  if (!applicationIds.length) return [];
  return db
    .select({ ai: applicationInstitutions, institutionName: institutions.name })
    .from(applicationInstitutions)
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .where(inArray(applicationInstitutions.applicationId, applicationIds))
    .orderBy(asc(applicationInstitutions.createdAt));
}
