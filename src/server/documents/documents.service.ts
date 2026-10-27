import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { ADMIN_STATUS_LABELS } from "@/lib/admin/status";
import { EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import { ADMISSION_STATUS_LABELS, letterDate, letterText, type AdmissionStatus } from "@/lib/admissions/letter";
import { DOC_TYPES, type DocBlock, type DocModel, type DocType } from "@/lib/documents/data";
import { institutionTuitionView } from "@/lib/tuition/data";
import type { ApplicationStatus } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import {
  admissions,
  applicantProfiles,
  applicationDocuments,
  applicationInstitutions,
  applicationStatusEvents,
  applications,
  departments,
  faculties,
  feePayments,
  files,
  institutions,
  matriculations,
  medicalRecords,
  parameters,
  programChoices,
  programs,
  tuitionAccounts,
  users,
} from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { hasPermission } from "@/server/auth/access";
import { ForbiddenError, NotFoundError } from "@/server/http/errors";
import { getSettings } from "@/server/modules/settings/settings.service";
import { getDemographicRecord, listEducation } from "@/server/modules/student/profile.service";
import { listResults, loadExaminations } from "@/server/modules/student/examinations.service";
import { letterContent, openInstitutionLetter, openLetterAsAdmin, openStudentLetter } from "@/server/modules/deliberation/letter.service";
import { getAccountForAdmin } from "@/server/modules/tuition/tuition.service";
import { renderDocumentPdf } from "./render";
import { storageFor } from "@/server/storage/driver";
import { getLang, getT } from "@/lib/i18n/server";
import type { Lang } from "@/lib/i18n/core";

/**
 * Printable documents for one application to one institution (the
 * "subject"), built from the database at the moment they are asked for:
 *
 *   application-summary      the application at a glance
 *   completed-application    everything the applicant submitted
 *   submission-confirmation  proof it reached the institution
 *   payment-record           application fee and tuition payments
 *   admission-letter         the letter as issued (a stored PDF, BE-28)
 *   matriculation-record     enrolment, with the matriculation code
 *
 * Who may open what is decided here, for the preview and the PDF alike:
 *
 *   applicant      their own applications, every document once it exists
 *   institution    only applications made to it, once submitted and the
 *                  fee approved (as for the applicant's uploaded documents);
 *                  payment records need "Student Payments & Uploads" and show
 *                  only approved payments, never the web fee; admission
 *                  letters need "Deliberation List"
 *   Cheeta admin   every document
 *
 * Anyone else is told the application doesn't exist. Each opening by
 * someone other than the applicant is recorded in the audit trail.
 */

export type Audience = "student" | "institution" | "admin";

interface Subject {
  id: string;
  applicantId: string;
  institutionId: string;
  status: ApplicationStatus;
  reference: string;
  applicationNumber: string | null;
  submittedAt: Date | null;
  declarationAcceptedAt: Date | null;
  declarationVersion: string | null;
  createdAt: Date;
  academicYear: string | null;
  studentName: string;
  email: string;
  phone: string | null;
  registrationNo: string | null;
  institution: { name: string; address: string; location: string; phone: string; email: string; website: string };
  feeApproved: boolean;
  admission: { id: string; status: string; number: string | null; offeredAt: Date | null; programId: string } | null;
  accountId: string | null;
  matriculation: { code: string; matriculatedAt: Date; note: string; confirmedBy: string | null } | null;
}

const audienceOf = (user: PublicUser): Audience => (user.role === "STUDENT" ? "student" : user.role === "AOSA_ADMIN" ? "admin" : "institution");

async function loadSubject(db: Executor, idOrAccount: string): Promise<Subject | null> {
  // Screens about admitted students link by tuition account; documents belong to the application behind it.
  let id = idOrAccount;
  if (idOrAccount.startsWith("tui")) {
    const [a] = await db
      .select({ id: admissions.applicationInstitutionId })
      .from(tuitionAccounts)
      .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
      .where(eq(tuitionAccounts.id, idOrAccount))
      .limit(1);
    if (!a) return null;
    id = a.id;
  }
  const [r] = await db
    .select({
      ai: applicationInstitutions,
      applicantId: applications.applicantId,
      createdAt: applications.createdAt,
      academicYear: parameters.label,
      studentName: users.fullName,
      email: users.email,
      phone: users.phone,
      registrationNo: applicantProfiles.registrationNo,
      inst: { name: institutions.name, address: institutions.address, location: institutions.location, phone: institutions.phone, email: institutions.email, website: institutions.website },
    })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .leftJoin(parameters, eq(parameters.id, applications.academicYearId))
    .where(eq(applicationInstitutions.id, id))
    .limit(1);
  if (!r) return null;
  const [[fee], [adm], [acct]] = await Promise.all([
    db.select({ id: feePayments.id }).from(feePayments).where(and(eq(feePayments.applicationInstitutionId, id), eq(feePayments.approval, "APPROVED"))).limit(1),
    db.select().from(admissions).where(eq(admissions.applicationInstitutionId, id)).limit(1),
    db
      .select({ id: tuitionAccounts.id })
      .from(tuitionAccounts)
      .innerJoin(admissions, eq(admissions.id, tuitionAccounts.admissionId))
      .where(eq(admissions.applicationInstitutionId, id))
      .limit(1),
  ]);
  const [mat] = acct
    ? await db
        .select({ m: matriculations, by: users.fullName })
        .from(matriculations)
        .leftJoin(users, eq(users.id, matriculations.confirmedBy))
        .where(and(eq(matriculations.tuitionAccountId, acct.id), eq(matriculations.status, "MATRICULATED")))
        .limit(1)
    : [];
  return {
    id,
    applicantId: r.applicantId,
    institutionId: r.ai.institutionId,
    status: r.ai.status as ApplicationStatus,
    reference: r.ai.reference,
    applicationNumber: r.ai.applicationNumber,
    submittedAt: r.ai.submittedAt,
    declarationAcceptedAt: r.ai.declarationAcceptedAt,
    declarationVersion: r.ai.declarationVersion,
    createdAt: r.createdAt,
    academicYear: r.academicYear,
    studentName: r.studentName,
    email: r.email,
    phone: r.phone,
    registrationNo: r.registrationNo,
    institution: r.inst,
    feeApproved: !!fee,
    admission: adm ? { id: adm.id, status: adm.status, number: adm.admissionNumber, offeredAt: adm.offeredAt, programId: adm.programId } : null,
    accountId: acct?.id ?? null,
    matriculation: mat ? { code: mat.m.code, matriculatedAt: mat.m.matriculatedAt, note: mat.m.note, confirmedBy: mat.by } : null,
  };
}

/** The application, if `user` may see its documents at all; otherwise "not found", whichever reason. */
async function subjectFor(user: PublicUser, id: string): Promise<Subject> {
  const s = await loadSubject(getDb(), id);
  if (!s) throw new NotFoundError("Application");
  if (user.role === "AOSA_ADMIN") return s;
  if (user.role === "STUDENT") {
    if (s.applicantId !== user.id) throw new NotFoundError("Application");
    return s;
  }
  // Institution staff: their own institution's applications, once submitted and the fee approved.
  if (!user.institutionId || user.institutionId !== s.institutionId || EDITABLE_STATUSES.includes(s.status) || !s.feeApproved) throw new NotFoundError("Application");
  return s;
}

export interface Availability {
  available: boolean;
  reason?: string;
}

async function availabilityOf(user: PublicUser, s: Subject): Promise<Record<DocType, Availability>> {
  const db = getDb();
  const aud = audienceOf(user);
  const submitted = !!s.submittedAt && !!s.applicationNumber;
  const notYet = (reason: string): Availability => ({ available: false, reason });
  const staffNeeds = async (key: "PAYMENTS_UPLOADS" | "DELIBERATION", label: string): Promise<Availability | null> =>
    aud === "institution" && !(await hasPermission(db, user, key)) ? notYet(`Needs the "${label}" permission.`) : null;

  const [fees] = await db.select({ n: sql<number>`count(*)::int` }).from(feePayments).where(eq(feePayments.applicationInstitutionId, s.id));
  let payment: Availability = fees.n > 0 || s.accountId ? { available: true } : notYet("Available once a payment is recorded.");
  if (aud === "institution") payment = (await staffNeeds("PAYMENTS_UPLOADS", "Student Payments & Uploads")) ?? { available: true };

  return {
    "application-summary": { available: true },
    "completed-application": submitted ? { available: true } : notYet("Available once the application is submitted."),
    "submission-confirmation": submitted ? { available: true } : notYet("Available once the application is submitted."),
    "payment-record": payment,
    "admission-letter": !s.admission ? notYet("Issued once the institution offers a place.") : (await staffNeeds("DELIBERATION", "Deliberation List")) ?? { available: true },
    "matriculation-record": s.matriculation ? { available: true } : notYet("Issued once the student is matriculated."),
  };
}

// ---------------------------------------------------------------------------
// Building the documents
// ---------------------------------------------------------------------------

const DAY_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Douala" });
const TIME_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });
const DAY_FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Douala" });
const TIME_FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });
const dayIn = (lang: Lang, d: Date | string) => (lang === "fr" ? DAY_FR : DAY_FMT).format(new Date(d));
const timeIn = (lang: Lang, d: Date | string) => (lang === "fr" ? TIME_FR : TIME_FMT).format(new Date(d));
const money = (n: number, currency = "XAF") => `${Math.round(n).toLocaleString("en-US")} ${currency}`;

const ABBR: Record<DocType, string> = {
  "application-summary": "AS",
  "completed-application": "CA",
  "submission-confirmation": "SC",
  "payment-record": "PR",
  "admission-letter": "AL",
  "matriculation-record": "MR",
};

const ACTOR = { applicant: "Applicant", institution: "Institution", system: "Platform", admin: "Cheeta administration" } as Record<string, string>;

async function choicesOf(db: Executor, id: string) {
  return db
    .select({ rank: programChoices.rank, program: programs.name, code: programs.code, faculty: faculties.name, department: departments.name })
    .from(programChoices)
    .innerJoin(programs, eq(programs.id, programChoices.programId))
    .innerJoin(faculties, eq(faculties.id, programs.facultyId))
    .innerJoin(departments, eq(departments.id, programs.departmentId))
    .where(eq(programChoices.applicationInstitutionId, id))
    .orderBy(asc(programChoices.rank));
}

async function buildModel(user: PublicUser, s: Subject, type: DocType): Promise<DocModel> {
  const tr = await getT();
  const lang = await getLang();
  // Dates and amounts in the reader's language, shadowing the English helpers.
  const day = (d: Date | string | null | undefined) => (d ? dayIn(lang, d) : "—");
  const time = (d: Date | string | null | undefined) => (d ? timeIn(lang, d) : "—");
  const money = (n: number, currency = "XAF") => `${Math.round(n).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")} ${currency}`;
  const db = getDb();
  const aud = audienceOf(user);
  const platform = (await getSettings("system", db)).platformName;
  const appId = s.applicationNumber ?? s.reference;
  const number = type === "matriculation-record" && s.matriculation ? `MR-${s.matriculation.code.replace(/\//g, "-")}` : `AOSA-${ABBR[type]}-${appId.replace(/[^A-Z0-9]/gi, "")}`;
  const issuedAt = new Date().toISOString();
  const aosa = { name: tr("Cheeta Academia Online"), lines: [platform, tr("School Application Platform")] };
  const inst = { name: s.institution.name, lines: [[s.institution.address, s.institution.location].filter(Boolean).join(", "), [s.institution.phone, s.institution.email, s.institution.website].filter(Boolean).join(" · ")] };
  const recipient = { name: s.studentName, lines: [s.email, s.registrationNo ? tr("Registration no. {registrationNo}", { registrationNo: s.registrationNo }) : ""].filter(Boolean) };
  const footnote = tr("Generated on {value} from the records of the {platform}. Document no. {number}. Cheeta administration can confirm it against the record.", { value: time(issuedAt), platform, number });
  const base = { type, number, issuedAt, footnote, lang };
  const choices = await choicesOf(db, s.id);
  const status = tr(ADMIN_STATUS_LABELS[s.status] ?? s.status);

  switch (type) {
    case "application-summary": {
      const [fee] = await db.select().from(feePayments).where(eq(feePayments.applicationInstitutionId, s.id)).orderBy(desc(feePayments.createdAt)).limit(1);
      const feeLine = !fee
        ? tr("No payment recorded")
        : aud === "institution"
          ? fee.approval === "APPROVED"
            ? tr("Approved (bank code {bankCode})", { bankCode: fee.bankCode })
            : tr("Awaiting approval")
          : `${money(fee.amount, fee.currency)}, ${fee.approval === "APPROVED" ? tr("approved (bank code {bankCode})", { bankCode: fee.bankCode }) : fee.approval === "REJECTED" ? tr("rejected") : tr("awaiting approval")}`;
      return {
        ...base,
        title: tr("Application summary"),
        issuer: aosa,
        recipient,
        blocks: [
          {
            kind: "fields",
            fields: [
              { label: tr("Applicant"), value: s.studentName },
              { label: tr("Application ID"), value: s.applicationNumber ?? tr("Not submitted yet (reference {reference})", { reference: s.reference }) },
              { label: tr("Institution"), value: s.institution.name },
              { label: tr("Academic year"), value: s.academicYear ?? "—" },
              { label: tr("Status"), value: status },
              { label: tr("Started"), value: day(s.createdAt) },
              { label: tr("Submitted"), value: day(s.submittedAt) },
              { label: tr("Application fee"), value: feeLine },
              ...(s.admission ? [{ label: tr("Admission"), value: `${s.admission.number ?? ""} (${tr(ADMISSION_STATUS_LABELS[s.admission.status as AdmissionStatus] ?? s.admission.status)})` }] : []),
            ],
          },
          { kind: "table", title: tr("Program choices"), columns: [tr("Choice"), tr("Program"), tr("Faculty / School")], rows: choices.map((c) => [String(c.rank), c.code ? `${c.program} (${c.code})` : c.program, c.faculty]), empty: tr("No programs chosen yet.") },
        ],
      };
    }

    case "completed-application": {
      const who = { id: s.applicantId } as PublicUser;
      const [{ profile: p }, education, exams, results, docs] = await Promise.all([
        getDemographicRecord(who),
        listEducation(who),
        loadExaminations(db, s.applicantId),
        listResults(who),
        db.select({ name: applicationDocuments.requirementName, status: applicationDocuments.reviewStatus, at: applicationDocuments.createdAt }).from(applicationDocuments).where(eq(applicationDocuments.applicationInstitutionId, s.id)).orderBy(asc(applicationDocuments.requirementName)),
      ]);
      const blocks: DocBlock[] = [
        {
          kind: "fields",
          title: tr("Personal details"),
          fields: [
            { label: tr("Full name (birth certificate)"), value: p.fullNameOnBirthCertificate || s.studentName },
            { label: tr("Date of birth"), value: p.dateOfBirth ? day(p.dateOfBirth) : "—" },
            { label: tr("Place of birth"), value: [p.placeOfBirth, p.countryOfBirth].filter(Boolean).join(", ") || "—" },
            { label: tr("Sex"), value: p.sex || "—" },
            { label: tr("Nationality"), value: p.nationality || "—" },
            { label: tr("Region / division of origin"), value: [p.regionOfOrigin, p.divisionOfOrigin].filter(Boolean).join(" / ") || "—" },
            { label: tr("Residence"), value: [p.townOfResidence, p.countryOfResidence].filter(Boolean).join(", ") || "—" },
            { label: tr("Marital status"), value: p.maritalStatus || "—" },
            { label: tr("Email"), value: s.email },
            { label: tr("Telephone"), value: [s.phone, p.alternativeTelephone].filter(Boolean).join(" / ") || "—" },
            { label: tr("Preferred language"), value: p.preferredLanguage || "—" },
          ],
        },
        {
          kind: "fields",
          title: tr("Parents or guardians"),
          fields: [
            { label: tr("Father"), value: p.fathersNames || "—" },
            { label: tr("Mother"), value: p.mothersNames || "—" },
            { label: tr("Address"), value: [p.parentsAddress, p.parentsTownCity, p.parentsCountry].filter(Boolean).join(", ") || "—" },
            { label: tr("Contact"), value: [p.parentsTelephone, p.parentsEmail].filter(Boolean).join(" · ") || "—" },
          ],
        },
        { kind: "table", title: tr("Education"), columns: [tr("Years"), tr("School"), tr("Type"), tr("Qualification"), tr("Country")], rows: education.map((e) => [`${e.startYear}–${e.endYear}`, e.schoolName, e.schoolType, e.qualification, e.country]), empty: tr("No education recorded.") },
        {
          kind: "table",
          title: tr("Examinations"),
          columns: [tr("Qualification"), tr("Sitting"), tr("Year"), tr("Candidate no."), tr("Centre no.")],
          rows: exams.flatMap((x) => x.sittings.map((st) => [x.qualification, String(st.sittingNo), st.examinationYear, st.candidateNumber, st.centreNumber])),
          empty: tr("No examinations recorded."),
        },
        { kind: "table", title: tr("Results"), columns: [tr("Qualification"), tr("Subject"), tr("Grade / mark"), tr("Result")], rows: results.map((r) => [r.qualification, r.subject, String(r.value ?? ""), r.result ?? "—"]), empty: tr("No results recorded.") },
        { kind: "table", title: tr("Program choices"), columns: [tr("Choice"), tr("Program"), tr("Faculty / School"), tr("Department")], rows: choices.map((c) => [String(c.rank), c.program, c.faculty, c.department]) },
        { kind: "table", title: tr("Documents uploaded"), columns: [tr("Document"), tr("Uploaded"), tr("Review")], rows: docs.map((d) => [d.name, day(d.at), d.status === "APPROVED" ? tr("Accepted") : d.status === "REJECTED" ? tr("Not accepted") : tr("Not reviewed yet")]), empty: tr("No documents uploaded.") },
        {
          kind: "text",
          title: tr("Declaration"),
          paragraphs: [
            tr("I, {studentName}, declare that the information in this application is true and complete, and understand that false information may lead to its rejection or to an offer being withdrawn.", { studentName: p.fullNameOnBirthCertificate || s.studentName }),
            tr("Accepted on {value} (declaration version {value2}).", { value: time(s.declarationAcceptedAt), value2: s.declarationVersion ?? "—" }),
          ],
        },
        { kind: "signatures", lines: [{ name: s.studentName, role: `Applicant, submitted ${day(s.submittedAt)}` }] },
      ];
      const [prof] = await db.select({ photoFileId: applicantProfiles.photoFileId }).from(applicantProfiles).where(eq(applicantProfiles.userId, s.applicantId)).limit(1);
      const photo = prof?.photoFileId ? { fileId: prof.photoFileId, url: `/api/files/${encodeURIComponent(prof.photoFileId)}` } : null;
      return { ...base, title: tr("Completed application"), issuer: aosa, recipient: { name: s.institution.name, lines: [tr("Application {appId}", { appId })] }, photo, blocks };
    }

    case "submission-confirmation": {
      const events = await db
        .select({ status: applicationStatusEvents.status, actor: applicationStatusEvents.actor, at: applicationStatusEvents.at, note: applicationStatusEvents.note })
        .from(applicationStatusEvents)
        .where(and(eq(applicationStatusEvents.applicationInstitutionId, s.id), notInArray(applicationStatusEvents.status, ["INCOMPLETE", "COMPLETED"])))
        .orderBy(asc(applicationStatusEvents.at));
      return {
        ...base,
        title: tr("Submission confirmation"),
        issuer: aosa,
        recipient,
        blocks: [
          { kind: "text", paragraphs: [tr("Your application to {name} was received on {value}. Quote the Application ID below in any correspondence.", { name: s.institution.name, value: time(s.submittedAt) })] },
          { kind: "code", label: tr("Application ID"), value: appId },
          {
            kind: "fields",
            fields: [
              { label: tr("Institution"), value: s.institution.name },
              { label: tr("Programs"), value: choices.map((c) => `${c.rank}. ${c.program}`).join("\n") || "—" },
              { label: tr("Academic year"), value: s.academicYear ?? "—" },
              { label: tr("Submitted"), value: time(s.submittedAt) },
              { label: tr("Declaration"), value: tr("Version {version}, accepted {value}", { version: s.declarationVersion ?? "—", value: time(s.declarationAcceptedAt) }) },
              { label: tr("Status now"), value: status },
            ],
          },
          { kind: "table", title: tr("Since submission"), columns: [tr("Date"), tr("Status"), tr("By")], rows: events.map((e) => [time(e.at), tr(ADMIN_STATUS_LABELS[e.status as ApplicationStatus] ?? e.status), tr(ACTOR[e.actor] ?? e.actor)]) },
        ],
      };
    }

    case "payment-record": {
      const fees = await db.select().from(feePayments).where(eq(feePayments.applicationInstitutionId, s.id)).orderBy(asc(feePayments.createdAt));
      const blocks: DocBlock[] = [];
      if (aud === "institution") {
        // The institution sees approved payments by bank code, and its own fee only.
        const approved = fees.filter((f) => f.approval === "APPROVED");
        blocks.push({ kind: "table", title: tr("Application fee"), columns: [tr("Approved"), tr("Bank code"), tr("Application fee")], numeric: [2], rows: approved.map((f) => [day(f.reviewedAt), f.bankCode ?? "", money(f.applicationFee, f.currency)]), empty: tr("No approved payment.") });
      } else {
        blocks.push({
          kind: "table",
          title: tr("Application fee"),
          columns: [tr("Paid"), tr("Reference"), tr("Amount"), tr("Status"), tr("Bank code")],
          numeric: [2],
          rows: fees.map((f) => [day(f.paidAt), f.reference, money(f.amount, f.currency), f.approval === "APPROVED" ? tr("Approved") : f.approval === "REJECTED" ? tr("Rejected: {reason}", { reason: tr(f.rejectionReason ?? "") }) : tr("Awaiting approval"), f.bankCode ?? "—"]),
          empty: tr("No payment recorded."),
        });
      }
      if (s.accountId) {
        const acct = await getAccountForAdmin(s.accountId);
        if (aud === "institution") {
          const v = institutionTuitionView(acct);
          if (!v.masked) {
            blocks.push({ kind: "fields", title: tr("Tuition"), fields: [{ label: tr("Tuition"), value: money(acct.tuitionAmount, acct.currency) }, { label: tr("Verified"), value: money(v.confirmed ?? 0, acct.currency) }, { label: tr("Outstanding"), value: money(v.outstanding ?? 0, acct.currency) }] });
            blocks.push({ kind: "table", title: tr("Verified tuition payments"), columns: [tr("Verified"), tr("Bank code"), tr("Amount"), tr("Received")], numeric: [2], rows: v.confirmedPayments.map((p) => [day(p.verifiedAt), p.bankCode, money(p.amount, acct.currency), p.receivedAt ? day(p.receivedAt) : tr("Not yet")]) });
            if (v.awaitingCount) blocks.push({ kind: "text", paragraphs: [v.awaitingCount === 1 ? tr("1 further payment is awaiting verification by Cheeta administration and not shown.") : tr("{count} further payments are awaiting verification by Cheeta administration and not shown.", { count: v.awaitingCount })] });
          }
        } else {
          const f = acct.figures;
          blocks.push({
            kind: "fields",
            title: tr("Tuition"),
            fields: [
              { label: tr("Tuition"), value: money(f.tuition, acct.currency) },
              { label: tr("Verified"), value: money(f.verified, acct.currency) },
              { label: tr("Awaiting verification"), value: money(f.awaiting, acct.currency) },
              { label: tr("Outstanding"), value: money(f.outstanding, acct.currency) },
            ],
          });
          blocks.push({
            kind: "table",
            title: tr("Tuition payments"),
            columns: [tr("Paid"), tr("Reference"), tr("Amount"), tr("Status"), tr("Bank code")],
            numeric: [2],
            rows: acct.payments.map((p) => [day(p.paidOn), p.reference, money(p.amount, acct.currency), p.status === "VERIFIED" ? tr("Verified") : p.status === "REJECTED" ? tr("Rejected") : p.status === "QUERIED" ? tr("Query open") : tr("Awaiting verification"), p.bankCode ?? "—"]),
            empty: tr("No tuition payment recorded."),
          });
        }
      }
      blocks.push({ kind: "text", paragraphs: [tr("Only payments approved or verified by Cheeta administration count. No money is handled by the platform: payments are made to the institution's accounts and recorded here.")] });
      return { ...base, title: tr("Payment record"), issuer: aosa, recipient, blocks };
    }

    case "admission-letter": {
      const c = await letterContent(db, s.admission!.id);
      const t = letterText(c);
      return {
        ...base,
        number: c.admissionNumber,
        title: t.title,
        issuer: inst,
        recipient: { name: c.applicant.name, lines: [c.applicant.email] },
        blocks: [
          { kind: "fields", fields: t.reference.map(([label, value]) => ({ label, value })) },
          { kind: "text", title: t.subject, paragraphs: [t.greeting, ...t.opening] },
          { kind: "fields", fields: t.details.filter(([, v]) => v).map(([label, value]) => ({ label, value })) },
          { kind: "text", title: t.stepsTitle, paragraphs: t.steps.map((x, i) => `${i + 1}. ${x}`) },
          { kind: "text", paragraphs: [t.conditions, t.closing.join("\n")] },
        ],
        footnote: c.language === "fr" ? `${t.footer}. Date d'admission : ${letterDate(c.admissionDate, "fr")}.` : `${t.footer}. Admission date ${letterDate(c.admissionDate)}.`,
        lang: c.language,
      };
    }

    case "matriculation-record": {
      const m = s.matriculation!;
      const [prog] = await db
        .select({ program: programs.name, code: programs.code, faculty: faculties.name, department: departments.name })
        .from(programs)
        .innerJoin(faculties, eq(faculties.id, programs.facultyId))
        .innerJoin(departments, eq(departments.id, programs.departmentId))
        .where(eq(programs.id, s.admission!.programId))
        .limit(1);
      const acct = await getAccountForAdmin(s.accountId!);
      const med = await db.select().from(medicalRecords).where(eq(medicalRecords.tuitionAccountId, s.accountId!)).orderBy(asc(medicalRecords.requirementCode));
      return {
        ...base,
        title: tr("Matriculation record"),
        issuer: inst,
        recipient,
        blocks: [
          { kind: "code", label: tr("Matriculation code"), value: m.code, caption: tr("Use this code on all correspondence with {name}.", { name: s.institution.name }) },
          {
            kind: "fields",
            fields: [
              { label: tr("Student"), value: s.studentName },
              { label: tr("Registration no."), value: s.registrationNo ?? "—" },
              { label: tr("Program"), value: prog?.code ? `${prog.program} (${prog.code})` : prog?.program ?? "—" },
              { label: tr("Faculty / Department"), value: prog ? `${prog.faculty} / ${prog.department}` : "—" },
              { label: tr("Academic year"), value: s.academicYear ?? "—" },
              { label: tr("Application ID"), value: appId },
              { label: tr("Admission no."), value: s.admission?.number ?? "—" },
              { label: tr("Matriculated"), value: time(m.matriculatedAt) },
            ],
          },
          {
            kind: "table",
            title: tr("Conditions met"),
            columns: [tr("Condition"), tr("Detail")],
            rows: [
              [tr("Admission"), tr("Offer taken up ({value})", { value: s.admission?.number ?? "" })],
              [tr("Tuition"), tr("{value} of {value2} verified", { value: money(acct.figures.verified, acct.currency), value2: money(acct.tuitionAmount, acct.currency) })],
              ...med.filter((r) => r.required).map((r) => [r.requirementLabel || r.requirementCode, tr("{result}, verified {value}", { result: r.result === "CONDITIONAL" ? tr("Fit with conditions") : r.result === "FIT" ? tr("Fit") : r.result ?? "—", value: day(r.verificationDate) })]),
            ],
          },
          ...(m.note ? [{ kind: "text", paragraphs: [m.note] } as DocBlock] : []),
          { kind: "signatures", lines: [{ name: m.confirmedBy ?? tr("Registrar"), role: tr("For {name}", { name: s.institution.name }) }] },
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** The applications whose documents `user` may open, for the document centres. */
export async function listSubjects(user: PublicUser, opts: { q?: string; institutionId?: string } = {}) {
  const db = getDb();
  const like = opts.q ? `%${opts.q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const where = and(
    user.role === "STUDENT" ? eq(applications.applicantId, user.id) : undefined,
    user.role !== "STUDENT" && user.role !== "AOSA_ADMIN" ? eq(applicationInstitutions.institutionId, user.institutionId ?? "-") : undefined,
    user.role === "AOSA_ADMIN" && opts.institutionId ? eq(applicationInstitutions.institutionId, opts.institutionId) : undefined,
    // Staff see submitted applications whose fee is approved.
    user.role !== "STUDENT" ? and(isNotNull(applicationInstitutions.submittedAt), sql`EXISTS (SELECT 1 FROM fee_payments f WHERE f.application_institution_id = ${applicationInstitutions.id} AND f.approval = 'APPROVED')`) : undefined,
    like ? or(ilike(users.fullName, like), ilike(applicationInstitutions.applicationNumber, like), ilike(applicantProfiles.registrationNo, like)) : undefined
  );
  const rows = await db
    .select({ id: applicationInstitutions.id, applicationNumber: applicationInstitutions.applicationNumber, reference: applicationInstitutions.reference, status: applicationInstitutions.status, studentName: users.fullName, registrationNo: applicantProfiles.registrationNo, institutionId: institutions.id, institutionName: institutions.name })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .where(where)
    .orderBy(desc(applicationInstitutions.submittedAt))
    .limit(500);
  const ids = rows.map((r) => r.id);
  const progs = ids.length
    ? await db
        .select({ id: programChoices.applicationInstitutionId, program: programs.name, rank: programChoices.rank })
        .from(programChoices)
        .innerJoin(programs, eq(programs.id, programChoices.programId))
        .where(inArray(programChoices.applicationInstitutionId, ids))
    : [];
  return rows.map((r) => ({
    ...r,
    applicationId: r.applicationNumber ?? r.reference,
    statusLabel: ADMIN_STATUS_LABELS[r.status as ApplicationStatus] ?? r.status,
    programName: progs.filter((p) => p.id === r.id).sort((a, b) => a.rank - b.rank)[0]?.program ?? "",
  }));
}

/** One application's documents: which can be opened now, and why not otherwise. */
export async function documentsFor(user: PublicUser, id: string) {
  const s = await subjectFor(user, id);
  const available = await availabilityOf(user, s);
  return {
    id: s.id,
    applicationId: s.applicationNumber ?? s.reference,
    studentName: s.studentName,
    registrationNo: s.registrationNo,
    institutionName: s.institution.name,
    status: ADMIN_STATUS_LABELS[s.status] ?? s.status,
    documents: DOC_TYPES.map((d) => ({ ...d, ...available[d.type] })),
  };
}

async function openable(user: PublicUser, id: string, type: DocType) {
  const s = await subjectFor(user, id);
  const a = (await availabilityOf(user, s))[type];
  if (!a.available) {
    // A missing permission is a refusal; a document that doesn't exist yet is not found.
    if (a.reason?.startsWith("Needs the")) throw new ForbiddenError(`${a.reason}`);
    throw new NotFoundError(DOC_TYPES.find((d) => d.type === type)?.label ?? "Document");
  }
  return s;
}

/** The document's content, as the screens show it. */
export async function documentModel(user: PublicUser, id: string, type: DocType) {
  const s = await openable(user, id, type);
  return buildModel(user, s, type);
}

/**
 * The document as a PDF. The admission letter is the stored letter as
 * issued; the others are generated now from the database.
 */
export async function documentPdf(user: PublicUser, id: string, type: DocType): Promise<{ name: string; bytes: Uint8Array } | { file: Awaited<ReturnType<typeof openStudentLetter>> }> {
  const s = await openable(user, id, type);
  if (user.role !== "STUDENT") {
    await audit(getDb(), { action: "download", entityType: "document", entityId: `${s.id}:${type}`, institutionId: s.institutionId, meta: { type, application: s.applicationNumber ?? s.reference } });
  }
  if (type === "admission-letter") {
    if (user.role === "STUDENT") return { file: await openStudentLetter(user, s.id) };
    if (user.role === "AOSA_ADMIN") return { file: await openLetterAsAdmin(user, s.admission!.id) };
    return { file: await openInstitutionLetter(user, s.admission!.id) };
  }
  const model = await buildModel(user, s, type);
  // The photo is read here, as part of a document this viewer may already open; the PDF carries the image itself.
  let photo: { bytes: Uint8Array; mimeType: string } | undefined;
  if (model.photo) {
    const [f] = await getDb().select().from(files).where(and(eq(files.id, model.photo.fileId), isNull(files.deletedAt))).limit(1);
    const stream = f ? await storageFor(f.storageDriver)?.get(f.storageKey) : null;
    if (f && stream) photo = { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), mimeType: f.mimeType };
  }
  return { name: `${model.title.replace(/\s+/g, "-")}-${model.number}.pdf`, bytes: await renderDocumentPdf(model, { photo }) };
}
