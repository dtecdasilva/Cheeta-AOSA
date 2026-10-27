import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { createApplicantAccount } from "@/lib/auth/users";
import { getDb } from "@/server/db/client";
import { applicantProfiles, applicationDocuments, applicationFees, applicationInstitutions, applicationStatusEvents, applications, demographicProfiles, educationRecords, examinationRecords, examinationResults, feePayments, institutions, parameters, programChoices, programs, uploadRequirements, users } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { pagination, parseQuery, parseWith } from "@/server/http/validate";
import { sendLoginCredentials } from "@/server/notifications/delivery";
import { registrableInstitutionTypes } from "@/server/modules/institutions/institutionTypes";
import { listResults, loadExaminations } from "@/server/modules/student/examinations.service";
import { photoOf } from "@/server/modules/student/photo.service";

/**
 * What Cheeta administration's dashboard, student and application screens
 * read: every student and every application on the platform, in the shapes
 * those screens were built on (src/lib/admin/students.ts). Administration
 * only; the routes refuse anyone else.
 */

const page = pagination.extend({ pageSize: z.coerce.number().int().min(1).max(500).default(200) });

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/** Every registered student. Self-registered students' details come from their demographic record where the profile has none. */
export async function listStudentsForAdmin(req: NextRequest) {
  const q = parseQuery(req, page);
  const [data, [{ total }]] = await Promise.all([loadStudents({ limit: q.pageSize, offset: (q.page - 1) * q.pageSize }), getDb().select({ total: count() }).from(users).where(eq(users.role, "STUDENT"))]);
  return { data, meta: { page: q.page, pageSize: q.pageSize, total } };
}

async function loadStudents(opts: { limit?: number; offset?: number; ids?: string[] }) {
  const db = getDb();
  const [rows, params] = await Promise.all([
    db
      .select({ u: users, p: applicantProfiles, d: { sex: demographicProfiles.sex, dateOfBirth: demographicProfiles.dateOfBirth, region: demographicProfiles.regionOfOrigin, town: demographicProfiles.townOfResidence } })
      .from(users)
      .innerJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
      .leftJoin(demographicProfiles, eq(demographicProfiles.userId, users.id))
      .where(and(eq(users.role, "STUDENT"), opts.ids ? inArray(users.id, opts.ids) : undefined))
      .orderBy(desc(users.createdAt), asc(users.id))
      .limit(opts.limit ?? 500)
      .offset(opts.offset ?? 0),
    db.select({ id: parameters.id, category: parameters.category, label: parameters.label }).from(parameters).where(inArray(parameters.category, ["regions", "towns"])),
  ]);
  const ids = rows.map((r) => r.u.id);
  const quals = ids.length
    ? await db.select({ userId: educationRecords.userId, qualification: educationRecords.qualification, endYear: educationRecords.endYear }).from(educationRecords).where(inArray(educationRecords.userId, ids))
    : [];
  const paramByLabel = (category: string, label: string) => (label ? params.find((p) => p.category === category && p.label.toLowerCase() === label.toLowerCase())?.id ?? "" : "");
  return rows.map(({ u, p, d }) => {
    const [first, ...rest] = u.fullName.trim().split(/\s+/);
    const latest = quals.filter((x) => x.userId === u.id).sort((a, b) => b.endYear.localeCompare(a.endYear))[0];
    const sex = p.gender ?? (d?.sex === "Male" || d?.sex === "Female" ? d.sex : null);
    return {
      id: u.id,
      registrationNo: p.registrationNo,
      firstName: p.firstName ?? first ?? "",
      lastName: p.lastName ?? rest.join(" "),
      gender: sex ?? "",
      dateOfBirth: p.dateOfBirth ?? d?.dateOfBirth ?? "",
      email: u.email,
      phone: u.phone ?? p.mobileNumber,
      regionId: p.regionId ?? paramByLabel("regions", d?.region ?? ""),
      townId: p.townId ?? paramByLabel("towns", d?.town ?? ""),
      address: p.address,
      highestQualification: p.highestQualification || latest?.qualification || "",
      registeredAt: u.createdAt,
      source: p.source,
      status: u.status,
      emailVerified: u.emailVerifiedAt !== null,
    };
  });
}

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  gender: z.enum(["Male", "Female"], { error: "Choose the student's sex." }),
  dateOfBirth: z.iso.date({ error: "Enter a date of birth." }),
  email: z.email({ error: "Enter an email address like name@example.com." }).max(200),
  phone: z.string().trim().min(8, "Enter a phone number with at least 8 digits.").max(30),
  regionId: z.string().trim().min(1, "Choose a region.").max(100),
  townId: z.string().trim().min(1, "Choose a town.").max(100),
  address: z.string().trim().max(300).default(""),
  highestQualification: z.string().trim().max(200).default(""),
  institutionType: z.string().trim().max(100).optional(),
});

/**
 * Registers a student on their behalf: the same account a student makes
 * for themselves, marked "Registered by admin", with the details entered
 * here. Their login details are emailed to them.
 */
export async function registerStudentForAdmin(admin: PublicUser, input: unknown) {
  const v = parseWith(registerSchema, input);
  if (v.dateOfBirth > new Date().toISOString().slice(0, 10)) throw new ValidationError({ dateOfBirth: "The date of birth can't be in the future." });
  if (v.phone.replace(/\D/g, "").length < 8) throw new ValidationError({ phone: "Enter a phone number with at least 8 digits." });
  const db = getDb();
  const [region] = await db.select({ id: parameters.id }).from(parameters).where(and(eq(parameters.id, v.regionId), eq(parameters.category, "regions"))).limit(1);
  const [town] = await db.select({ id: parameters.id, parentId: parameters.parentId }).from(parameters).where(and(eq(parameters.id, v.townId), eq(parameters.category, "towns"))).limit(1);
  if (!region) throw new ValidationError({ regionId: "Choose a region." });
  if (!town || town.parentId !== region.id) throw new ValidationError({ townId: "Choose a town in that region." });
  const types = await registrableInstitutionTypes();
  const institutionType = types.includes(v.institutionType as (typeof types)[number]) ? (v.institutionType as (typeof types)[number]) : types[0];

  const result = await createApplicantAccount({ email: v.email, institutionType, mobileNumber: v.phone });
  if (result.status === "exists") throw new ConflictError("A student with this email is already registered.", { fieldErrors: { email: "A student with this email is already registered." } });
  const id = result.user.id;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ fullName: `${v.firstName} ${v.lastName}` }).where(eq(users.id, id));
    await tx
      .update(applicantProfiles)
      .set({ firstName: v.firstName, lastName: v.lastName, gender: v.gender, dateOfBirth: v.dateOfBirth, regionId: v.regionId, townId: v.townId, address: v.address, highestQualification: v.highestQualification, source: "Registered by admin" })
      .where(eq(applicantProfiles.userId, id));
    await audit(tx, { action: "register", entityType: "account", entityId: id, actorUserId: admin.id, after: { email: result.user.email, source: "Registered by admin", registrationNo: result.user.registrationNo } });
  });
  await sendLoginCredentials({ ...result.user, fullName: `${v.firstName} ${v.lastName}` }, result.temporaryCode);
  const [row] = await loadStudents({ ids: [id] });
  return row;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

const PAYMENT_STATUS = { APPROVED: "PAID", AWAITING: "PENDING", REJECTED: "FAILED" } as const;

/** Every application to every institution, with its status history and latest fee payment. */
export async function listApplicationDataset(req: NextRequest) {
  const q = parseQuery(req, page);
  const db = getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ ai: applicationInstitutions, studentId: applications.applicantId })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .orderBy(desc(applicationInstitutions.updatedAt), asc(applicationInstitutions.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ total: count() }).from(applicationInstitutions),
  ]);
  const ids = rows.map((r) => r.ai.id);
  const [events, choices, pays] = ids.length
    ? await Promise.all([
        db.select().from(applicationStatusEvents).where(inArray(applicationStatusEvents.applicationInstitutionId, ids)).orderBy(asc(applicationStatusEvents.at)),
        db
          .select({ id: programChoices.applicationInstitutionId, name: programs.name })
          .from(programChoices)
          .innerJoin(programs, eq(programs.id, programChoices.programId))
          .where(and(inArray(programChoices.applicationInstitutionId, ids), eq(programChoices.rank, 1))),
        db.select().from(feePayments).where(inArray(feePayments.applicationInstitutionId, ids)).orderBy(desc(feePayments.createdAt)),
      ])
    : [[], [], []];
  const data = rows.map(({ ai, studentId }) => {
    const pay = pays.find((p) => p.applicationInstitutionId === ai.id);
    return {
      id: ai.id,
      reference: ai.applicationNumber ?? ai.reference,
      studentId,
      institutionId: ai.institutionId,
      programName: choices.find((c) => c.id === ai.id)?.name ?? "",
      createdAt: ai.createdAt,
      updatedAt: ai.updatedAt,
      status: ai.status,
      history: events.filter((e) => e.applicationInstitutionId === ai.id).map((e) => ({ status: e.status, at: e.at, actor: e.actor, note: e.note })),
      payment: pay
        ? {
            method: pay.method,
            reference: pay.reference,
            amount: pay.amount,
            applicationFee: pay.applicationFee,
            webFee: pay.webFee,
            status: PAYMENT_STATUS[pay.approval as keyof typeof PAYMENT_STATUS] ?? "PENDING",
            initiatedAt: pay.submittedAt ?? pay.createdAt,
            paidAt: pay.approval === "APPROVED" ? pay.paidAt ?? pay.reviewedAt : null,
          }
        : null,
    };
  });
  return { data, meta: { page: q.page, pageSize: q.pageSize, total } };
}


// ---------------------------------------------------------------------------
// One student's full record
// ---------------------------------------------------------------------------

type SectionStatus = "DONE" | "IN_PROGRESS" | "NOT_STARTED";
const FEE_STATE = { APPROVED: "PAID", AWAITING: "DEPOSITED", REJECTED: "REJECTED" } as const;

/**
 * Everything Cheeta administration's student screen shows about one
 * applicant: the full demographic record (printable), when each section
 * was started and last changed, each institution applied to with its
 * uploads and choices, and the fees with the application fee and the web
 * fee shown apart.
 */
export async function studentRecordForAdmin(id: string) {
  const db = getDb();
  const [row] = await db
    .select({ u: users, p: applicantProfiles })
    .from(users)
    .innerJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .where(and(eq(users.id, id), eq(users.role, "STUDENT")))
    .limit(1);
  if (!row) throw new NotFoundError("Student");
  const who = { id } as PublicUser;
  const [[summary], demo, education, exams, results, photo, apps] = await Promise.all([
    loadStudents({ ids: [id] }),
    db.select().from(demographicProfiles).where(eq(demographicProfiles.userId, id)).limit(1),
    db.select().from(educationRecords).where(eq(educationRecords.userId, id)).orderBy(asc(educationRecords.startYear)),
    loadExaminations(db, id),
    listResults(who),
    photoOf(db, id),
    db
      .select({ ai: applicationInstitutions, institution: { id: institutions.id, name: institutions.name } })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
      .where(eq(applications.applicantId, id))
      .orderBy(asc(applicationInstitutions.createdAt)),
  ]);
  const d = demo[0] ?? null;
  const [examRows, resultRows] = await Promise.all([
    db.select({ createdAt: examinationRecords.createdAt, updatedAt: examinationRecords.updatedAt }).from(examinationRecords).where(eq(examinationRecords.userId, id)),
    db.select({ createdAt: examinationResults.createdAt, updatedAt: examinationResults.updatedAt }).from(examinationResults).where(eq(examinationResults.userId, id)),
  ]);
  const span = (rows: { createdAt: Date; updatedAt: Date }[], done: boolean) => ({
    startedAt: rows.length ? new Date(Math.min(...rows.map((r) => r.createdAt.getTime()))).toISOString() : null,
    updatedAt: rows.length ? new Date(Math.max(...rows.map((r) => r.updatedAt.getTime()))).toISOString() : null,
    status: (rows.length ? (done ? "DONE" : "IN_PROGRESS") : "NOT_STARTED") as SectionStatus,
  });
  const sections = [
    { key: "demographic", label: "Demographic Information", ...span(d ? [d] : [], !!d?.submittedAt) },
    { key: "education", label: "Education Information", ...span(education, education.length > 0) },
    { key: "examinations", label: "Examinations Information", ...span(examRows, examRows.length > 0) },
    { key: "results", label: "Results Information", ...span(resultRows, resultRows.length > 0) },
  ];

  const aiIds = apps.map((a) => a.ai.id);
  const instIds = [...new Set(apps.map((a) => a.institution.id))];
  const [docs, reqs, choiceRows, feeRows, pays] = aiIds.length
    ? await Promise.all([
        db.select({ aiId: applicationDocuments.applicationInstitutionId, requirementId: applicationDocuments.requirementId }).from(applicationDocuments).where(inArray(applicationDocuments.applicationInstitutionId, aiIds)),
        db.select({ id: uploadRequirements.id, institutionId: uploadRequirements.institutionId }).from(uploadRequirements).where(and(inArray(uploadRequirements.institutionId, instIds), eq(uploadRequirements.status, "ACTIVE"), eq(uploadRequirements.required, true))),
        db.select({ aiId: programChoices.applicationInstitutionId }).from(programChoices).where(inArray(programChoices.applicationInstitutionId, aiIds)),
        db.select().from(applicationFees).where(inArray(applicationFees.applicationInstitutionId, aiIds)),
        db.select().from(feePayments).where(inArray(feePayments.applicationInstitutionId, aiIds)).orderBy(desc(feePayments.createdAt)),
      ])
    : [[], [], [], [], []];

  const institutionRows = apps.map(({ ai, institution }) => {
    const required = reqs.filter((r) => r.institutionId === institution.id);
    const mine = new Set(docs.filter((x) => x.aiId === ai.id).map((x) => x.requirementId));
    return {
      id: ai.id,
      institution: institution.name,
      reference: ai.reference,
      applicationNumber: ai.applicationNumber,
      uploads: { done: required.filter((r) => mine.has(r.id)).length, required: required.length },
      choices: choiceRows.filter((c) => c.aiId === ai.id).length,
      startedAt: ai.createdAt.toISOString(),
      updatedAt: ai.updatedAt.toISOString(),
      status: ai.status,
    };
  });

  const feeLines = apps.map(({ ai, institution }) => {
    const pay = pays.find((p) => p.applicationInstitutionId === ai.id && p.approval !== "REJECTED") ?? pays.find((p) => p.applicationInstitutionId === ai.id);
    const fee = feeRows.find((f) => f.applicationInstitutionId === ai.id);
    // A recorded payment carries the figures it was made for; until then, what the application is being asked to pay.
    const src = pay ?? fee;
    const state = pay ? FEE_STATE[pay.approval as keyof typeof FEE_STATE] ?? "PENDING" : "PENDING";
    // One payment covers both: the application fee (the institution's) and the web fee (the platform's) share its state.
    return { id: ai.id, institution: institution.name, currency: src?.currency ?? "XAF", applicationFee: src?.applicationFee ?? null, webFee: src?.webFee ?? null, applicationFeeState: state, webFeeState: state, reference: pay?.reference ?? null };
  });
  const total = (k: "applicationFee" | "webFee") => feeLines.reduce((s, l) => s + (l[k] ?? 0), 0);

  return {
    student: summary,
    account: { status: row.u.status, emailVerified: row.u.emailVerifiedAt !== null, lastSignInAt: row.u.lastSignInAt?.toISOString?.() ?? null },
    photo,
    demographic: d ? { ...Object.fromEntries(Object.entries(d).filter(([k]) => !["userId", "createdAt", "updatedAt", "submittedAt"].includes(k))) } : null,
    education: education.map((e) => ({ startYear: e.startYear, endYear: e.endYear, schoolName: e.schoolName, schoolType: e.schoolType, qualification: e.qualification, country: e.country })),
    examinations: exams.map((x) => ({ qualification: x.qualification, sittings: x.sittings.map((st) => ({ sittingNo: st.sittingNo, year: st.examinationYear, centreNumber: st.centreNumber, candidateNumber: st.candidateNumber })) })),
    results: results.map((r) => ({ qualification: r.qualification, subject: r.subject, value: String(r.value ?? ""), result: r.result ?? null })),
    sections,
    institutions: institutionRows,
    fees: { lines: feeLines, totals: { applicationFee: total("applicationFee"), webFee: total("webFee") } },
  };
}
