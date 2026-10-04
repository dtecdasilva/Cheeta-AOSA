import "server-only";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import {
  applicationDocuments,
  applicationFees,
  applicationInstitutions,
  applicationStatusEvents,
  applications,
  feeConfigs,
  feePayments,
  institutions,
  parameters,
  programChoices,
  programs,
  uploadRequirements,
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
 * The application fee an institution charges nationals today: its active
 * "application" fee config, falling back to the suggested amount on the
 * APP fee type. In XAF, with the fee schedule entry it came from (null
 * for the fallback).
 */
export async function applicationFeeFor(db: Executor, institutionId: string): Promise<number> {
  return (await applicationFeeQuote(db, institutionId)).amount;
}

async function applicationFeeQuote(db: Executor, institutionId: string): Promise<{ amount: number; feeConfigId: string | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const [fee] = await db
    .select({ id: feeConfigs.id, amount: feeConfigs.amount })
    .from(feeConfigs)
    .where(and(eq(feeConfigs.institutionId, institutionId), eq(feeConfigs.type, "application"), eq(feeConfigs.category, "national"), eq(feeConfigs.status, "ACTIVE"), lte(feeConfigs.effectiveDate, today)))
    .orderBy(desc(feeConfigs.effectiveDate))
    .limit(1);
  if (fee) return { amount: fee.amount, feeConfigId: fee.id };
  const [type] = await db.select({ attrs: parameters.attrs }).from(parameters).where(eq(parameters.id, "fee-types:APP")).limit(1);
  return { amount: Number(type?.attrs?.defaultAmount ?? 0), feeConfigId: null };
}

/**
 * Works out what one application to one institution costs and stores it
 * on that application (application_fees), replacing any earlier figure.
 * Called when the institution is added and again when a payment is
 * recorded, so the stored fee is always the one the applicant is asked to
 * pay; once a payment is awaiting approval or approved it no longer moves.
 */
export async function assessApplicationFee(db: Executor, app: { id: string; institutionId: string; webFee: number }) {
  const quote = await applicationFeeQuote(db, app.institutionId);
  const row = { feeConfigId: quote.feeConfigId, applicationFee: quote.amount, webFee: app.webFee, amount: quote.amount + app.webFee, assessedAt: new Date() };
  await db
    .insert(applicationFees)
    .values({ applicationInstitutionId: app.id, ...row })
    .onConflictDoUpdate({ target: applicationFees.applicationInstitutionId, set: row });
  return row;
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

  const [choices, documents, payments, events, requirements] = await Promise.all([
    db
      .select({ id: programChoices.id, rank: programChoices.rank, programId: programs.id, programName: programs.name, programCode: programs.code })
      .from(programChoices)
      .innerJoin(programs, eq(programs.id, programChoices.programId))
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
  ]);

  return { ...row.ai, application: row.app, institution: row.institution, choices, documents, payments, events, requirements };
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
