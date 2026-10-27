import "server-only";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { institutionAbbr, programAbbr } from "@/lib/matriculation/data";
import { maskFullName } from "@/lib/payments/privacy";
import { getDb, type Executor } from "@/server/db/client";
import {
  admissions,
  applicantProfiles,
  applicationInstitutions,
  applications,
  institutions,
  matriculations,
  medicalRecords,
  programs,
  tuitionAccounts,
  tuitionPayments,
  users,
} from "@/server/db/schema";
import { newId, nextCounter } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/http/errors";
import { parseWith, text } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";
import { medicalClearance, syncMedicalRecords } from "@/server/modules/medical/medical.service";

/**
 * Matriculation: an admitted student becomes an enrolled one and gets their
 * matriculation code. Allowed only when all three hold, checked by the
 * server at the moment of confirming:
 *
 *   1. Admission  the student has taken up the offer;
 *   2. Tuition    Cheeta administration has verified payments covering at
 *                 least the first instalment;
 *   3. Medical    every required medical requirement is verified, none Unfit.
 *
 * Only the administrator of the student's institution, or Cheeta
 * administration, can confirm (or cancel) a matriculation. Admission users
 * can see where students stand but can't matriculate anyone.
 *
 * The record keeps the student, institution, program, code, date and
 * status. A matriculation made in error is cancelled with a reason, not
 * deleted, and its code is never issued again.
 */

type Tuition = "PAID_IN_FULL" | "CLEARED" | "NOT_CLEARED";

export interface MatricApiRow {
  account: {
    id: string;
    studentId: string;
    studentName: string;
    registrationNo: string;
    applicationRef: string;
    institutionId: string;
    institutionName: string;
    programId: string;
    programName: string;
    admittedAt: string;
    offerAccepted: boolean;
    /** Tuition figures behind the tuition condition: what is owed, the first instalment, and what Cheeta has verified. */
    tuitionAmount: number;
    firstInstalment: number;
    verified: number;
    currency: string;
  };
  admission: "ACCEPTED" | "AWAITING_REPLY";
  tuition: Tuition;
  medical: ReturnType<typeof medicalClearance>;
  medicalRecords: { id: string; requirementCode: string; requirementLabel: string; required: boolean; status: string; result: string | null; verificationDate: string | null }[];
  status: "NOT_READY" | "READY" | "MATRICULATED";
  record: { id: string; code: string; matriculatedAt: string; confirmedBy: string; note: string; status: "MATRICULATED" } | null;
  /** Earlier matriculations of this student that were cancelled. */
  cancelled: { code: string; matriculatedAt: string; cancelledAt: string | null; cancelReason: string | null }[];
  blockers: string[];
  maskedForInstitution: boolean;
}

async function loadRows(db: Executor, where: SQL | undefined): Promise<MatricApiRow[]> {
  const accounts = await db
    .select({
      t: tuitionAccounts,
      admissionStatus: admissions.status,
      admissionType: admissions.type,
      conditionStatus: admissions.conditionStatus,
      admittedAt: admissions.offeredAt,
      programId: admissions.programId,
      programName: programs.name,
      studentId: users.id,
      studentName: users.fullName,
      registrationNo: applicantProfiles.registrationNo,
      applicationRef: sql<string>`coalesce(${applicationInstitutions.applicationNumber}, ${applicationInstitutions.reference})`,
      institutionId: applicationInstitutions.institutionId,
      institutionName: institutions.name,
    })
    .from(tuitionAccounts)
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .innerJoin(programs, eq(programs.id, admissions.programId))
    .where(where)
    .orderBy(desc(tuitionAccounts.createdAt));
  if (!accounts.length) return [];
  const ids = accounts.map((a) => a.t.id);
  const [pays, meds, mats] = await Promise.all([
    db.select({ accountId: tuitionPayments.accountId, amount: tuitionPayments.amount, status: tuitionPayments.status }).from(tuitionPayments).where(inArray(tuitionPayments.accountId, ids)),
    db.select().from(medicalRecords).where(inArray(medicalRecords.tuitionAccountId, ids)),
    db
      .select({ m: matriculations, by: users.fullName })
      .from(matriculations)
      .leftJoin(users, eq(users.id, matriculations.confirmedBy))
      .where(inArray(matriculations.tuitionAccountId, ids))
      .orderBy(desc(matriculations.matriculatedAt)),
  ]);

  return accounts.map((a) => {
    const p = pays.filter((x) => x.accountId === a.t.id);
    const verified = p.filter((x) => x.status === "VERIFIED").reduce((s, x) => s + x.amount, 0);
    const first = a.t.instalments[0]?.amount ?? a.t.tuitionAmount;
    const tuition: Tuition = verified >= a.t.tuitionAmount ? "PAID_IN_FULL" : verified >= first ? "CLEARED" : "NOT_CLEARED";
    const m = meds.filter((x) => x.tuitionAccountId === a.t.id);
    const medical = medicalClearance(m);
    const live = mats.find((x) => x.m.tuitionAccountId === a.t.id && x.m.status === "MATRICULATED");
    const admission = a.admissionStatus === "ACCEPTED" ? "ACCEPTED" : "AWAITING_REPLY";
    const outstanding = m.filter((r) => r.required && !(r.status === "VERIFIED" && (r.result === "FIT" || r.result === "CONDITIONAL"))).map((r) => r.requirementLabel || r.requirementCode);
    const unfit = m.filter((r) => r.result === "UNFIT").map((r) => r.requirementLabel || r.requirementCode);
    const blockers: string[] = [];
    if (a.admissionStatus === "WITHDRAWN") blockers.push("The provisional admission was withdrawn: its conditions weren't met.");
    else if (admission !== "ACCEPTED") blockers.push("The student hasn't taken up the offer.");
    if (a.admissionType === "PROVISIONAL" && a.admissionStatus !== "WITHDRAWN") blockers.push("The admission is provisional: the institution hasn't yet confirmed its conditions are met.");
    if (tuition === "NOT_CLEARED") blockers.push("Verified tuition payments don't yet cover the first instalment.");
    if (unfit.length) blockers.push(`Medical result Unfit: ${unfit.join(", ")}.`);
    else if (medical !== "CLEARED") blockers.push(`Medical verification isn't complete${outstanding.length ? `: ${outstanding.join(", ")}` : ""}.`);
    return {
      account: {
        id: a.t.id,
        studentId: a.studentId,
        studentName: a.studentName,
        registrationNo: a.registrationNo ?? "",
        applicationRef: a.applicationRef,
        institutionId: a.institutionId,
        institutionName: a.institutionName,
        programId: a.programId,
        programName: a.programName,
        admittedAt: (a.admittedAt ?? a.t.createdAt).toISOString(),
        offerAccepted: admission === "ACCEPTED",
        tuitionAmount: a.t.tuitionAmount,
        firstInstalment: first,
        verified,
        currency: a.t.currency,
      },
      admission,
      tuition,
      medical,
      medicalRecords: m.map((r) => ({ id: r.id, requirementCode: r.requirementCode, requirementLabel: r.requirementLabel || r.requirementCode, required: r.required, status: r.status, result: r.result, verificationDate: r.verificationDate ? String(r.verificationDate) : null })),
      status: live ? "MATRICULATED" : blockers.length ? "NOT_READY" : "READY",
      record: live ? { id: live.m.id, code: live.m.code, matriculatedAt: live.m.matriculatedAt.toISOString(), confirmedBy: live.by ?? "", note: live.m.note, status: "MATRICULATED" } : null,
      cancelled: mats
        .filter((x) => x.m.tuitionAccountId === a.t.id && x.m.status === "CANCELLED")
        .map((x) => ({ code: x.m.code, matriculatedAt: x.m.matriculatedAt.toISOString(), cancelledAt: x.m.cancelledAt?.toISOString() ?? null, cancelReason: x.m.cancelReason })),
      blockers,
      // Same rule as the tuition screens: a student with only unverified payments is a masked name to the institution.
      maskedForInstitution: verified === 0 && p.some((x) => x.status === "PENDING" || x.status === "QUERIED"),
    };
  });
}

/** What the institution may see of a row: a masked student shows only a masked name and where they stand. */
function forInstitution(r: MatricApiRow): MatricApiRow {
  if (!r.maskedForInstitution) return r;
  return { ...r, account: { ...r.account, studentName: maskFullName(r.account.studentName), registrationNo: "", applicationRef: "", studentId: "", tuitionAmount: 0, firstInstalment: 0, verified: 0 }, medicalRecords: [] };
}

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

/** Every admitted student and where they stand: Cheeta administration sees all (?institutionId= to narrow), institution staff their own. */
export async function listRows(user: PublicUser, institutionId?: string | null) {
  const scope = user.role === "AOSA_ADMIN" ? institutionId ?? null : institutionOf(user);
  const rows = await loadRows(getDb(), scope ? eq(applicationInstitutions.institutionId, scope) : undefined);
  return user.role === "AOSA_ADMIN" ? rows : rows.map(forInstitution);
}

/** The student's own: one row per offer they have taken up. */
export async function listMine(user: PublicUser) {
  return loadRows(getDb(), eq(applications.applicantId, user.id));
}

async function rowFor(db: Executor, accountId: string) {
  await syncMedicalRecords(db, accountId);
  const [row] = await loadRows(db, eq(tuitionAccounts.id, accountId));
  if (!row) throw new NotFoundError("Admitted student");
  return row;
}

/** Staff of another institution learn nothing, not even that the student exists. */
function assertScope(user: PublicUser, row: MatricApiRow) {
  if (user.role === "AOSA_ADMIN") return;
  if (!user.institutionId || user.institutionId !== row.account.institutionId) throw new NotFoundError("Admitted student");
}

/** Who may matriculate (or cancel): Cheeta administration, or the administrator of the student's institution. */
function assertMatriculator(user: PublicUser, row: MatricApiRow) {
  assertScope(user, row);
  if (user.role === "AOSA_ADMIN" || user.role === "INSTITUTION_ADMIN") return;
  throw new ForbiddenError("Only the institution's administrator or Cheeta administration can matriculate students.");
}

export async function getRow(user: PublicUser, accountId: string) {
  const row = await rowFor(getDb(), accountId);
  assertScope(user, row);
  return user.role === "AOSA_ADMIN" ? row : forInstitution(row);
}

/** Used by the medical service's matriculation check (kept for callers of the earlier API). */
export async function matriculationReadiness(db: Executor, accountId: string) {
  return rowFor(db, accountId);
}

/**
 * The next code for a student: institution / intake year / program /
 * sequence, e.g. MFU/26/CS/0142. The sequence comes from a counter per
 * prefix, so two confirmations at once can't get the same code; a code
 * already on record (cancelled ones included) is skipped.
 */
async function nextCode(tx: Executor, institutionName: string, programName: string, year: number) {
  const prefix = `${institutionAbbr(institutionName)}/${String(year).slice(2)}/${programAbbr(programName)}/`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = prefix + String(await nextCounter(tx, `matriculation:${prefix}`)).padStart(4, "0");
    const [taken] = await tx.select({ id: matriculations.id }).from(matriculations).where(eq(matriculations.code, code)).limit(1);
    if (!taken) return code;
  }
  throw new ConflictError("Couldn't issue a unique matriculation code. Try again.");
}

/**
 * Confirms matriculation and issues the code. Refused, saying what is
 * missing, unless admission, tuition and medical verification are all
 * complete at this moment; refused to anyone but the institution's
 * administrator or Cheeta administration.
 */
export async function confirmMatriculation(user: PublicUser, accountId: string, input: unknown) {
  const { note } = parseWith(z.object({ note: text(500).default("") }), input ?? {});
  const db = getDb();
  const row = await db.transaction(async (tx) => {
    // One confirmation at a time per student: the second waits, then finds the first.
    await tx.execute(sql`SELECT id FROM tuition_accounts WHERE id = ${accountId} FOR UPDATE`);
    const r = await rowFor(tx, accountId);
    assertMatriculator(user, r);
    if (r.record) throw new ConflictError(`Already matriculated: ${r.record.code}.`);
    if (r.blockers.length) throw new ConflictError(`Can't matriculate yet. ${r.blockers.join(" ")}`, { blockers: r.blockers });
    const year = new Date(r.account.admittedAt).getUTCFullYear();
    const code = await nextCode(tx, r.account.institutionName, r.account.programName, year);
    const [admission] = await tx.select({ id: tuitionAccounts.admissionId }).from(tuitionAccounts).where(eq(tuitionAccounts.id, accountId)).limit(1);
    const id = newId("mat");
    await tx.insert(matriculations).values({
      id,
      tuitionAccountId: accountId,
      studentId: r.account.studentId,
      institutionId: r.account.institutionId,
      programId: r.account.programId,
      admissionId: admission.id,
      code,
      status: "MATRICULATED",
      confirmedBy: user.id,
      note,
    });
    await audit(tx, { action: "matriculate", entityType: "matriculation", entityId: id, institutionId: r.account.institutionId, after: { code, studentId: r.account.studentId, programId: r.account.programId, accountId } });
    await notify(tx, {
      audience: "student",
      recipientUserId: r.account.studentId,
      category: "ADMISSION",
      title: "You are matriculated",
      summary: `${r.account.institutionName} has matriculated you on ${r.account.programName}. Your matriculation code is ${code}.`,
      important: true,
      action: { label: "View", href: "/student/matriculation" },
    });
    return rowFor(tx, accountId);
  });
  return user.role === "AOSA_ADMIN" ? row : forInstitution(row);
}

/**
 * Cancels a matriculation confirmed in error, with the reason. The record
 * stays, marked CANCELLED; its code is never issued again. The student's
 * medical records can be changed again, and they can be matriculated anew
 * once ready (with a new code).
 */
export async function cancelMatriculation(user: PublicUser, accountId: string, input: unknown) {
  const { reason } = parseWith(z.object({ reason: z.string({ error: "Say why it is being cancelled." }).trim().min(5, "Say why it is being cancelled.").max(500) }), input);
  const db = getDb();
  const row = await rowFor(db, accountId);
  assertMatriculator(user, row);
  if (!row.record) throw new ConflictError("This student isn't matriculated.");
  await db.transaction(async (tx) => {
    const [done] = await tx
      .update(matriculations)
      .set({ status: "CANCELLED", cancelledAt: new Date(), cancelledBy: user.id, cancelReason: reason })
      .where(and(eq(matriculations.id, row.record!.id), eq(matriculations.status, "MATRICULATED")))
      .returning({ id: matriculations.id });
    if (!done) throw new ConflictError("This matriculation has just been changed by someone else.");
    await audit(tx, { action: "cancel", entityType: "matriculation", entityId: row.record!.id, institutionId: row.account.institutionId, before: { status: "MATRICULATED", code: row.record!.code }, after: { status: "CANCELLED", reason } });
    await notify(tx, { audience: "student", recipientUserId: row.account.studentId, category: "ADMISSION", title: "Matriculation cancelled", summary: `Your matriculation ${row.record!.code} at ${row.account.institutionName} was cancelled: ${reason}`, important: true, action: { label: "View", href: "/student/matriculation" } });
  });
  return getRow(user, accountId);
}

/** Matriculations recorded before the student, institution, program and admission were stored with them. A no-op once done. */
export async function adoptLegacyMatriculations(db: Executor) {
  await db.execute(sql`
    UPDATE matriculations m
    SET student_id = a.applicant_id, institution_id = ai.institution_id, program_id = ad.program_id, admission_id = ad.id
    FROM tuition_accounts t
    JOIN admissions ad ON ad.id = t.admission_id
    JOIN application_institutions ai ON ai.id = ad.application_institution_id
    JOIN applications a ON a.id = ai.application_id
    WHERE t.id = m.tuition_account_id AND m.student_id IS NULL`);
}
