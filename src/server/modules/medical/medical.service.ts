import "server-only";
import { and, asc, eq, inArray, isNull, notExists, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { PublicUser } from "@/lib/auth/users";
import { BY_TYPE, MEDICAL_REQUIREMENTS, type MedicalClearance, type MedicalResult, type MedicalStatus } from "@/lib/medical/data";
import { getDb, type Executor } from "@/server/db/client";
import {
  admissions,
  applicantProfiles,
  applicationInstitutions,
  applications,
  files,
  institutions,
  matriculations,
  medicalEvents,
  medicalRecords,
  medicalRequirements,
  programs,
  tuitionAccounts,
  users,
} from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseQuery, parseWith, text } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";

/**
 * Medical verification for admitted students.
 *
 * Each institution sets what it asks for (medical requirements); without
 * any, the platform's defaults for its type apply. When a student takes up
 * an offer, a medical record is opened for each requirement. Cheeta
 * administration or the institution's administrator records how each
 * stands and, once checked, verifies it with its result (Fit, Fit with
 * conditions, Unfit): who verified it and when are kept. Admission users
 * can only look. Only outcomes are stored, never clinical detail.
 *
 * A student is medically cleared when every REQUIRED record is verified
 * and none is Unfit. Matriculation is refused until then
 * (server/modules/matriculation).
 */

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

const requirementSchema = z.object({
  programId: z.string().max(100).nullable().default(null),
  code: z.string({ error: "Enter a code." }).trim().min(2, "Enter a code.").max(30).transform((v) => v.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9-]+$/, "Use capital letters, digits and hyphens.")),
  label: z.string({ error: "Name the requirement." }).trim().min(2, "Name the requirement.").max(200),
  description: text(1000).default(""),
  required: z.boolean().default(true),
  validityMonths: z.number().int().min(1).max(60).nullable().default(null),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

async function typeCodeOf(db: Executor, institutionId: string): Promise<string> {
  const [i] = await db.select({ typeId: institutions.typeId }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  return (i?.typeId ?? "").split(":")[1] ?? "UNI";
}

/** The platform's default requirements for an institution's type, as requirement-shaped rows (no id). */
function defaultsFor(typeCode: string) {
  return (BY_TYPE[typeCode] ?? BY_TYPE.UNI).map((code) => {
    const r = MEDICAL_REQUIREMENTS.find((m) => m.code === code)!;
    return { id: null as string | null, programId: null as string | null, code, label: r.label, description: r.description, required: true, validityMonths: code === "MED-FIT" ? 3 : null, status: "ACTIVE" as const };
  });
}

/** What an institution asks of a student on one program: its own active requirements, else the platform defaults. */
async function requirementsFor(db: Executor, institutionId: string, programId: string) {
  const own = await db.select().from(medicalRequirements).where(eq(medicalRequirements.institutionId, institutionId));
  if (!own.length) return defaultsFor(await typeCodeOf(db, institutionId));
  return own.filter((r) => r.status === "ACTIVE" && (!r.programId || r.programId === programId));
}

/** The institution's requirements, or the defaults it is using while it has set none. */
export async function listRequirements(user: PublicUser) {
  const db = getDb();
  const institutionId = institutionOf(user);
  const own = await db
    .select({ r: medicalRequirements, program: programs.name })
    .from(medicalRequirements)
    .leftJoin(programs, eq(programs.id, medicalRequirements.programId))
    .where(eq(medicalRequirements.institutionId, institutionId))
    .orderBy(asc(medicalRequirements.code));
  if (own.length) return { usingDefaults: false, data: own.map((x) => ({ ...x.r, programName: x.program ?? "All programs" })) };
  return { usingDefaults: true, data: defaultsFor(await typeCodeOf(db, institutionId)).map((d) => ({ ...d, programName: "All programs" })) };
}

const assertAdmin = (user: PublicUser) => {
  if (user.role !== "INSTITUTION_ADMIN") throw new ForbiddenError("Only an institution administrator can change medical requirements.");
};

async function checkProgram(db: Executor, institutionId: string, programId: string | null) {
  if (!programId) return;
  const [p] = await db.select({ id: programs.id }).from(programs).where(and(eq(programs.id, programId), eq(programs.institutionId, institutionId))).limit(1);
  if (!p) throw new ValidationError({ programId: "Choose one of your programs." });
}

/**
 * Adds a requirement. The first one an institution adds replaces the
 * platform defaults: from then on it asks for exactly what it has set.
 * Applies to students who take up an offer from now on.
 */
export async function createRequirement(user: PublicUser, input: unknown) {
  assertAdmin(user);
  const institutionId = institutionOf(user);
  const v = parseWith(requirementSchema, input);
  const db = getDb();
  await checkProgram(db, institutionId, v.programId);
  const id = newId("mrq");
  const [row] = await db.insert(medicalRequirements).values({ id, institutionId, ...v, updatedBy: user.id }).onConflictDoNothing().returning();
  if (!row) throw new ConflictError("Another requirement already uses this code.", { field: "code" });
  await audit(db, { action: "create", entityType: "medical-requirement", entityId: id, institutionId, after: v });
  return row;
}

export async function updateRequirement(user: PublicUser, id: string, input: unknown) {
  assertAdmin(user);
  const institutionId = institutionOf(user);
  const db = getDb();
  const [before] = await db.select().from(medicalRequirements).where(and(eq(medicalRequirements.id, id), eq(medicalRequirements.institutionId, institutionId))).limit(1);
  if (!before) throw new NotFoundError("Medical requirement");
  // The code identifies the requirement on students' records, so it stays.
  const v = parseWith(requirementSchema, { ...before, ...(input as object), code: before.code });
  await checkProgram(db, institutionId, v.programId);
  const [row] = await db.update(medicalRequirements).set({ ...v, updatedBy: user.id }).where(eq(medicalRequirements.id, id)).returning();
  await audit(db, { action: "update", entityType: "medical-requirement", entityId: id, institutionId, before, after: v });
  return row;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

async function isMatriculated(db: Executor, accountId: string) {
  const [m] = await db.select({ id: matriculations.id }).from(matriculations).where(and(eq(matriculations.tuitionAccountId, accountId), eq(matriculations.status, "MATRICULATED"))).limit(1);
  return !!m;
}

/**
 * Makes sure a student has a record for every requirement that applies to
 * them now (a requirement added after they were admitted is added too).
 * Records already there are left as they are. Nothing changes once the
 * student is matriculated.
 */
export async function syncMedicalRecords(db: Executor, accountId: string) {
  if (await isMatriculated(db, accountId)) return;
  const [a] = await db
    .select({ institutionId: applicationInstitutions.institutionId, programId: admissions.programId })
    .from(tuitionAccounts)
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .where(eq(tuitionAccounts.id, accountId))
    .limit(1);
  if (!a) return;
  const reqs = await requirementsFor(db, a.institutionId, a.programId);
  if (!reqs.length) return;
  await db
    .insert(medicalRecords)
    .values(reqs.map((r) => ({ id: newId("med"), tuitionAccountId: accountId, requirementId: r.id, requirementCode: r.code, requirementLabel: r.label, required: r.required })))
    .onConflictDoNothing();
}

/** Records for students admitted before medical records were opened automatically, and any requirement added since. A no-op once done. */
export async function syncAllMedicalRecords(db: Executor) {
  const open = await db
    .select({ id: tuitionAccounts.id })
    .from(tuitionAccounts)
    .where(notExists(db.select({ x: sql`1` }).from(matriculations).where(and(eq(matriculations.tuitionAccountId, tuitionAccounts.id), eq(matriculations.status, "MATRICULATED")))));
  for (const a of open) await syncMedicalRecords(db, a.id);
}

/** Cleared when every required record is verified and none is Unfit (optional ones don't hold it up, but an Unfit result anywhere does). */
export function medicalClearance(records: { required: boolean; status: string; result: string | null }[]): MedicalClearance {
  if (records.some((r) => r.result === "UNFIT")) return "NOT_CLEARED";
  const required = records.filter((r) => r.required);
  if (required.length && required.every((r) => r.status === "VERIFIED" && (r.result === "FIT" || r.result === "CONDITIONAL"))) return "CLEARED";
  // An institution that asks for nothing has nothing to hold matriculation up.
  if (!required.length) return "CLEARED";
  return "IN_PROGRESS";
}

const verifier = sql<string | null>`(SELECT full_name FROM users WHERE users.id = ${medicalRecords.verifiedBy})`;

async function loadRecords(db: Executor, where: SQL | undefined, viewer: "staff" | "student") {
  const rows = await db
    .select({
      r: medicalRecords,
      verifiedByName: verifier,
      studentName: users.fullName,
      registrationNo: applicantProfiles.registrationNo,
      applicationRef: sql<string>`coalesce(${applicationInstitutions.applicationNumber}, ${applicationInstitutions.reference})`,
      institutionId: applicationInstitutions.institutionId,
      institutionName: institutions.name,
      programName: programs.name,
      matriculated: sql<boolean>`EXISTS (SELECT 1 FROM matriculations m WHERE m.tuition_account_id = ${medicalRecords.tuitionAccountId} AND m.status = 'MATRICULATED')`,
    })
    .from(medicalRecords)
    .innerJoin(tuitionAccounts, eq(tuitionAccounts.id, medicalRecords.tuitionAccountId))
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .innerJoin(programs, eq(programs.id, admissions.programId))
    .where(where)
    .orderBy(asc(users.fullName), asc(medicalRecords.requirementCode));
  const ids = rows.map((r) => r.r.id);
  const events = ids.length
    ? await db
        .select({ e: medicalEvents, by: users.fullName })
        .from(medicalEvents)
        .leftJoin(users, eq(users.id, medicalEvents.byUserId))
        .where(inArray(medicalEvents.medicalRecordId, ids))
        .orderBy(asc(medicalEvents.at))
    : [];
  return rows.map(({ r, ...x }) => ({
    id: r.id,
    accountId: r.tuitionAccountId,
    studentName: x.studentName,
    registrationNo: x.registrationNo ?? "",
    applicationRef: x.applicationRef,
    institutionId: x.institutionId,
    institutionName: x.institutionName,
    programName: x.programName,
    requirementCode: r.requirementCode,
    requirementLabel: r.requirementLabel || r.requirementCode,
    required: r.required,
    status: r.status as MedicalStatus,
    result: r.result as MedicalResult | null,
    verificationDate: r.verificationDate ? String(r.verificationDate) : null,
    // The verifier is named to staff; the student sees who verified it by role only.
    verifiedBy: x.verifiedByName ? (viewer === "student" ? "Medical verification" : x.verifiedByName) : null,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    centre: r.centre,
    certificateRef: r.certificateRef,
    certificateUrl: r.certificateFileId ? `/api/files/${encodeURIComponent(r.certificateFileId)}` : null,
    note: r.note,
    locked: x.matriculated,
    history: events
      .filter((e) => e.e.medicalRecordId === r.id)
      .map((e) => ({ at: e.e.at.toISOString(), by: viewer === "student" && e.e.byRole !== "student" ? "Medical verification" : e.by ?? "", role: e.e.byRole, status: e.e.status as MedicalStatus, result: e.e.result as MedicalResult | null, note: e.e.note })),
  }));
}

const listQuery = z.object({ institutionId: z.string().max(100).optional(), accountId: z.string().max(100).optional() });

/** Every record (Cheeta administration) or the institution's own (its staff), one per requirement per student. */
export async function listRecords(user: PublicUser, req: NextRequest) {
  const q = parseQuery(req, listQuery);
  const scope = user.role === "AOSA_ADMIN" ? q.institutionId : institutionOf(user);
  const db = getDb();
  // Open records for any requirement added since (cheap: insert ... on conflict do nothing).
  if (q.accountId) await syncMedicalRecords(db, q.accountId);
  const data = await loadRecords(db, and(scope ? eq(applicationInstitutions.institutionId, scope) : undefined, q.accountId ? eq(medicalRecords.tuitionAccountId, q.accountId) : undefined), "staff");
  const byAccount = new Map<string, typeof data>();
  for (const r of data) byAccount.set(r.accountId, [...(byAccount.get(r.accountId) ?? []), r]);
  return { data, clearance: Object.fromEntries([...byAccount].map(([id, rs]) => [id, medicalClearance(rs)])) };
}

/** The student's own records and whether they are medically cleared, per offer taken up. */
export async function listMine(user: PublicUser) {
  const db = getDb();
  const data = await loadRecords(db, eq(applications.applicantId, user.id), "student");
  const byAccount = new Map<string, typeof data>();
  for (const r of data) byAccount.set(r.accountId, [...(byAccount.get(r.accountId) ?? []), r]);
  return { data, clearance: Object.fromEntries([...byAccount].map(([id, rs]) => [id, medicalClearance(rs)])) };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const isoDate = z.iso.date({ error: "Enter a date." });
const updateSchema = z.object({
  status: z.enum(["NOT_STARTED", "SCHEDULED", "AWAITING", "VERIFIED", "RETEST"]),
  result: z.enum(["FIT", "CONDITIONAL", "UNFIT"]).nullable().default(null),
  verificationDate: isoDate.nullable().default(null),
  centre: text(200).nullable().default(null),
  certificateRef: text(100).nullable().default(null),
  certificateFileId: z.string().max(100).nullable().optional(),
  /** Date on the certificate, to check it against the requirement's validity. */
  certificateDate: isoDate.nullable().optional(),
  note: text(1000).default(""),
});

/** Who may change medical records: Cheeta administration, and the administrator of the student's institution. */
function assertVerifier(user: PublicUser, institutionId: string) {
  if (user.role === "AOSA_ADMIN") return;
  if (user.role === "INSTITUTION_ADMIN" && user.institutionId === institutionId) return;
  if (user.role === "INSTITUTION_ADMISSION_USER" && user.institutionId === institutionId) throw new ForbiddenError("Admission users can view medical verification but not change it.");
  throw new NotFoundError("Medical record");
}

/**
 * Records where a requirement stands. Verifying needs a result and the
 * verification date; Fit with conditions, Unfit and a retest need a note
 * saying why. A result can only go with VERIFIED. Who verified it and when
 * are recorded with the change. Nothing changes once the student is
 * matriculated.
 */
export async function updateRecord(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(updateSchema, input);
  const db = getDb();
  const [rec] = await db
    .select({ r: medicalRecords, institutionId: applicationInstitutions.institutionId, applicantId: applications.applicantId, validityMonths: medicalRequirements.validityMonths })
    .from(medicalRecords)
    .innerJoin(tuitionAccounts, eq(tuitionAccounts.id, medicalRecords.tuitionAccountId))
    .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .leftJoin(medicalRequirements, eq(medicalRequirements.id, medicalRecords.requirementId))
    .where(eq(medicalRecords.id, id))
    .limit(1);
  if (!rec) throw new NotFoundError("Medical record");
  assertVerifier(user, rec.institutionId);
  if (await isMatriculated(db, rec.r.tuitionAccountId)) throw new ConflictError("The student is matriculated, so their medical records can no longer be changed.");

  const today = new Date().toISOString().slice(0, 10);
  const errors: Record<string, string> = {};
  if (v.status === "VERIFIED") {
    if (!v.result) errors.result = "Choose the result.";
    if (!v.verificationDate) errors.verificationDate = "Enter the verification date.";
    if ((v.result === "CONDITIONAL" || v.result === "UNFIT") && v.note.trim().length < 3) errors.note = v.result === "CONDITIONAL" ? "Say what the conditions are." : "Say what happens next.";
  } else if (v.result) errors.result = "A result can only be recorded when the requirement is verified.";
  if (v.status === "RETEST" && v.note.trim().length < 3) errors.note = "Say why a retest is needed.";
  if (v.verificationDate && v.verificationDate > today) errors.verificationDate = "The verification date can't be in the future.";
  if ((v.status === "AWAITING" || v.status === "VERIFIED") && !v.certificateRef && !v.certificateFileId && !rec.r.certificateFileId) errors.certificateRef = "Enter the certificate or report reference.";
  if (v.status === "VERIFIED" && rec.validityMonths && v.certificateDate) {
    const limit = new Date(v.verificationDate ?? today);
    limit.setMonth(limit.getMonth() - rec.validityMonths);
    if (v.certificateDate < limit.toISOString().slice(0, 10)) errors.certificateDate = `The certificate must be less than ${rec.validityMonths} months old. Ask for a retest.`;
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  if (v.certificateFileId) {
    const [f] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, v.certificateFileId), eq(files.purpose, "medical-certificate"), isNull(files.deletedAt))).limit(1);
    if (!f) throw new ValidationError({ certificateFileId: "Upload the certificate again." });
  }

  const decided = v.status === "VERIFIED" || v.status === "RETEST";
  await db.transaction(async (tx) => {
    const [moved] = await tx
      .update(medicalRecords)
      .set({
        status: v.status,
        result: v.status === "VERIFIED" ? v.result : null,
        verificationDate: decided ? v.verificationDate ?? today : null,
        verifiedBy: decided ? user.id : null,
        verifiedAt: decided ? new Date() : null,
        centre: v.centre,
        certificateRef: v.certificateRef,
        ...(v.certificateFileId !== undefined ? { certificateFileId: v.certificateFileId } : {}),
        note: v.note.trim(),
      })
      // Unchanged since it was read: two people saving at once can't both win.
      // (The database keeps microseconds; the value read back has milliseconds, so compare at that precision.)
      .where(and(eq(medicalRecords.id, id), sql`date_trunc('milliseconds', ${medicalRecords.updatedAt}) = ${rec.r.updatedAt.toISOString()}::timestamptz`))
      .returning({ id: medicalRecords.id });
    if (!moved) throw new ConflictError("This record has just been changed by someone else. Reload it and try again.");
    await tx.insert(medicalEvents).values({ id: newId("mev"), medicalRecordId: id, byUserId: user.id, byRole: user.role === "AOSA_ADMIN" ? "admin" : "institution", status: v.status, result: v.status === "VERIFIED" ? v.result : null, note: v.note.trim() });
    await audit(tx, {
      action: decided ? "verify" : "update",
      entityType: "medical-record",
      entityId: id,
      institutionId: rec.institutionId,
      before: { status: rec.r.status, result: rec.r.result },
      after: { status: v.status, result: v.status === "VERIFIED" ? v.result : null, verificationDate: decided ? v.verificationDate ?? today : null },
    });
    if (decided && (v.status !== rec.r.status || v.result !== rec.r.result)) {
      const label = rec.r.requirementLabel || rec.r.requirementCode;
      const unfit = v.result === "UNFIT";
      await notify(tx, {
        audience: "student",
        recipientUserId: rec.applicantId,
        category: v.status === "RETEST" || unfit ? "REJECTION" : "VERIFICATION",
        title: v.status === "RETEST" ? `${label}: retest needed` : `${label} verified`,
        summary: v.status === "RETEST" ? v.note.trim() : unfit ? `Result: Unfit. ${v.note.trim()}` : v.result === "CONDITIONAL" ? `Fit with conditions: ${v.note.trim()}` : "Result: Fit.",
        important: v.status === "RETEST" || unfit,
        action: { label: "View medical verification", href: "/student/matriculation" },
      });
    }
  });
  const [out] = await loadRecords(db, eq(medicalRecords.id, id), "staff");
  return out;
}

/** For the matriculation check: the student's medical clearance, with the required requirements still outstanding. */
export async function medicalStatusFor(db: Executor, accountId: string) {
  await syncMedicalRecords(db, accountId);
  const rows = await db.select().from(medicalRecords).where(eq(medicalRecords.tuitionAccountId, accountId));
  const clearance = medicalClearance(rows);
  const outstanding = rows.filter((r) => r.required && !(r.status === "VERIFIED" && (r.result === "FIT" || r.result === "CONDITIONAL"))).map((r) => r.requirementLabel || r.requirementCode);
  return { clearance, outstanding, unfit: rows.filter((r) => r.result === "UNFIT").map((r) => r.requirementLabel || r.requirementCode) };
}


/** For reports: medical records as staff see them. */
export { loadRecords as loadMedicalRecords };
