import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { admissions, applicationInstitutions, applications, deliberationResults, deliberationRuns, departments, faculties, institutions, programs, users } from "@/server/db/schema";
import { newId, nextCounter } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { assertPermission } from "@/server/auth/access";
import { ForbiddenError, NotFoundError } from "@/server/http/errors";
import { pagination, parseQuery } from "@/server/http/validate";
import { env } from "@/server/config/env";
import { notifyEvent } from "@/server/notifications/engine";
import { openTuitionAccount } from "@/server/modules/tuition/tuition.service";

/**
 * The Admission List.
 *
 * An admission is only ever made here, from a published deliberation run:
 * nothing else in the platform creates one (the institution can't admit
 * by hand, and neither can Cheeta administration). Each record says which
 * program the applicant was admitted to, at which institution, on which
 * application, by which run and with which result, when, and where it
 * stands now.
 *
 *   OFFERED   made by the run; waiting for the applicant
 *   ACCEPTED  the applicant took up the place
 *   REJECTED  the applicant declined it
 *   WITHDRAWN a provisional offer withdrawn because its conditions weren't met
 *
 * An admission is FULL, or PROVISIONAL pending conditions (provisional.service.ts).
 */


/**
 * Creates the admission for one applicant a published run admitted.
 * Called by publishRun, inside its transaction, after the application has
 * been moved to ACCEPTED; `result` is the applicant's result in that run.
 */
export async function createAdmission(
  tx: Executor,
  params: { run: typeof deliberationRuns.$inferSelect; result: typeof deliberationResults.$inferSelect; institutionId: string; admittedBy: string; at: Date }
) {
  const { run, result } = params;
  if (result.outcome !== "ACCEPTED" || !result.programId || !result.choice) throw new Error("Only an applicant a run admitted can be given an admission.");
  const year = params.at.getUTCFullYear();
  const admissionNumber = `ADM-${year}-${String(await nextCounter(tx, `admission-number:${year}`)).padStart(6, "0")}`;
  const values = {
    institutionId: params.institutionId,
    programId: result.programId,
    choice: result.choice,
    status: "OFFERED" as const,
    deliberationRunId: run.id,
    deliberationResultId: result.id,
    admissionNumber,
    offeredAt: params.at,
    admittedBy: params.admittedBy,
    respondedAt: null,
  };
  // One admission per application. An application can only be on a run's admitted list while it is on the
  // Deliberation List, so this only replaces an earlier admission if an application went back onto the list.
  const [row] = await tx
    .insert(admissions)
    .values({ id: newId("adm"), applicationInstitutionId: result.applicationInstitutionId, ...values })
    .onConflictDoUpdate({ target: admissions.applicationInstitutionId, set: values })
    .returning();
  await audit(tx, {
    action: "create",
    entityType: "admission",
    entityId: row.id,
    institutionId: params.institutionId,
    after: { admissionNumber, programId: result.programId, choice: result.choice, applicationInstitutionId: result.applicationInstitutionId, deliberationRunId: run.id, status: "OFFERED" },
  });
  const [applicant] = await tx
    .select({ id: applications.applicantId, institution: institutions.name })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .where(eq(applicationInstitutions.id, result.applicationInstitutionId))
    .limit(1);
  await notifyEvent(tx, {
    event: "admission.offer",
    to: { userId: applicant.id },
    applicationId: result.applicationInstitutionId,
    values: { "admission.number": admissionNumber, "letter.url": `${env.APP_URL}/student/application/status` },
    inApp: { title: `Offer of admission from ${applicant.institution}`, summary: `${applicant.institution} has offered you a place (${admissionNumber}). Take up the offer and download your admission letter from your application.`, category: "ADMISSION" },
    important: true,
    action: { label: "Answer the offer", href: "/student/application/status" },
  });
  return row;
}

/** Records the applicant's answer to an offer on their admission. Called with the status change it goes with. */
export async function recordOfferResponse(tx: Executor, applicationInstitutionId: string, accepted: boolean) {
  const [before] = await tx.select().from(admissions).where(eq(admissions.applicationInstitutionId, applicationInstitutionId)).limit(1);
  if (!before) return;
  const status = accepted ? ("ACCEPTED" as const) : ("REJECTED" as const);
  await tx.update(admissions).set({ status, respondedAt: new Date() }).where(eq(admissions.id, before.id));
  await audit(tx, { action: "status", entityType: "admission", entityId: before.id, institutionId: before.institutionId, before: { status: before.status }, after: { status } });
  // Taking up the place opens the tuition account, with the tuition in force today.
  if (accepted) await openTuitionAccount(tx, before.id);
}

// ---------------------------------------------------------------------------
// Reading the list
// ---------------------------------------------------------------------------

const listQuery = pagination.extend({
  status: z.enum(["OFFERED", "ACCEPTED", "REJECTED", "WITHDRAWN"]).optional(),
  type: z.enum(["FULL", "PROVISIONAL"]).optional(),
  runId: z.string().max(100).optional(),
  programId: z.string().max(100).optional(),
  institutionId: z.string().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  /** Admission date range, YYYY-MM-DD, both inclusive. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

function select(db: Executor) {
  return db
    .select({
      a: admissions,
      applicant: users.fullName,
      email: users.email,
      reference: applicationInstitutions.reference,
      applicationNumber: applicationInstitutions.applicationNumber,
      applicationStatus: applicationInstitutions.status,
      institution: institutions.name,
      program: programs.name,
      programCode: programs.code,
      faculty: faculties.name,
      department: departments.name,
      runNumber: deliberationRuns.runNumber,
      reason: deliberationResults.note,
    })
    .from(admissions)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .innerJoin(programs, eq(programs.id, admissions.programId))
    .innerJoin(faculties, eq(faculties.id, programs.facultyId))
    .innerJoin(departments, eq(departments.id, programs.departmentId))
    .leftJoin(deliberationRuns, eq(deliberationRuns.id, admissions.deliberationRunId))
    .leftJoin(deliberationResults, eq(deliberationResults.id, admissions.deliberationResultId));
}

type Row = Awaited<ReturnType<ReturnType<typeof select>["limit"]>>[number];

function present(r: Row) {
  return {
    id: r.a.id,
    admissionNumber: r.a.admissionNumber,
    status: r.a.status,
    type: r.a.type,
    provisional:
      r.a.conditionStatus === null
        ? null
        : { conditions: r.a.conditions ?? "", deadline: r.a.conditionsDeadline, status: r.a.conditionStatus, decidedAt: r.a.conditionsDecidedAt, note: r.a.conditionsNote },
    admissionDate: r.a.offeredAt,
    respondedAt: r.a.respondedAt,
    institution: { id: r.a.institutionId, name: r.institution },
    program: { id: r.a.programId, name: r.program, code: r.programCode, faculty: r.faculty, department: r.department },
    choice: r.a.choice,
    application: { id: r.a.applicationInstitutionId, applicationNumber: r.applicationNumber ?? r.reference, status: r.applicationStatus },
    applicant: { name: r.applicant, email: r.email },
    letter: { issuedAt: r.a.letterIssuedAt, pdfUrl: `/api/institution/admissions/${encodeURIComponent(r.a.id)}/letter/pdf` },
    deliberation: r.a.deliberationRunId ? { runId: r.a.deliberationRunId, runNumber: r.runNumber, resultId: r.a.deliberationResultId, reason: r.reason } : null,
  };
}

async function list(req: NextRequest, scope?: string) {
  const q = parseQuery(req, listQuery);
  const db = getDb();
  const like = (v: string) => `%${v.replace(/[%_\\]/g, "\\$&")}%`;
  const conditions: (SQL | undefined)[] = [
    scope ? eq(applicationInstitutions.institutionId, scope) : q.institutionId ? eq(applicationInstitutions.institutionId, q.institutionId) : undefined,
    q.status ? eq(admissions.status, q.status) : undefined,
    q.type ? eq(admissions.type, q.type) : undefined,
    q.runId ? eq(admissions.deliberationRunId, q.runId) : undefined,
    q.programId ? eq(admissions.programId, q.programId) : undefined,
    q.from ? gte(admissions.offeredAt, new Date(`${q.from}T00:00:00+01:00`)) : undefined,
    q.to ? lt(admissions.offeredAt, new Date(new Date(`${q.to}T00:00:00+01:00`).getTime() + 86_400_000)) : undefined,
    q.q ? or(ilike(users.fullName, like(q.q)), ilike(admissions.admissionNumber, like(q.q)), ilike(applicationInstitutions.applicationNumber, like(q.q))) : undefined,
  ];
  const where = and(...conditions);
  const [rows, [{ total }], byStatus] = await Promise.all([
    select(db).where(where).orderBy(desc(admissions.offeredAt), asc(users.fullName)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db
      .select({ total: count() })
      .from(admissions)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .where(where),
    db
      .select({ status: admissions.status, n: count() })
      .from(admissions)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
      .where(scope ? eq(applicationInstitutions.institutionId, scope) : undefined)
      .groupBy(admissions.status),
  ]);
  return { data: rows.map(present), meta: { page: q.page, pageSize: q.pageSize, total }, counts: Object.fromEntries(byStatus.map((b) => [b.status, Number(b.n)])) };
}

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

const assertAccess = (db: Executor, user: PublicUser) => assertPermission(db, user, "DELIBERATION", "The admission list needs the \"Deliberation List\" permission.");

/** The caller's institution's Admission List: ?status=, ?runId=, ?programId=, ?q=. */
export async function listForInstitution(user: PublicUser, req: NextRequest) {
  await assertAccess(getDb(), user);
  return list(req, institutionOf(user));
}

export async function getForInstitution(user: PublicUser, id: string) {
  const db = getDb();
  await assertAccess(db, user);
  const [row] = await select(db).where(and(eq(admissions.id, id), eq(applicationInstitutions.institutionId, institutionOf(user)))).limit(1);
  if (!row) throw new NotFoundError("Admission");
  return present(row);
}

/** Every institution's admissions, for Cheeta administration: the same filters, plus ?institutionId=. */
export function listAll(req: NextRequest) {
  return list(req);
}

/** The admission on one application, as the applicant sees it, or null. */
export async function admissionFor(db: Executor, applicationInstitutionId: string) {
  const [row] = await select(db).where(eq(admissions.applicationInstitutionId, applicationInstitutionId)).limit(1);
  if (!row) return null;
  const a = present(row);
  return {
    admissionNumber: a.admissionNumber,
    status: a.status,
    type: a.type,
    provisional: a.provisional,
    admissionDate: a.admissionDate,
    respondedAt: a.respondedAt,
    program: a.program,
    choice: a.choice,
    letterUrl: `/api/student/applications/${encodeURIComponent(applicationInstitutionId)}/admission-letter`,
  };
}
