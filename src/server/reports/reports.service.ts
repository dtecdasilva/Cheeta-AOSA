import "server-only";
import { and, asc, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import type { PublicUser } from "@/lib/auth/users";
import { ADMIN_STATUS_LABELS, STAGES, reachedStages, stageLabel, type StageKey } from "@/lib/admin/status";
import { EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import { maskFullName } from "@/lib/payments/privacy";
import { institutionTuitionView } from "@/lib/tuition/data";
import type { ApplicationStatus } from "@/lib/types";
import { isReportKey, reportsFor, type ReportKey } from "@/components/reports/keys";
import { getDb, type Executor } from "@/server/db/client";
import {
  admissions,
  applicantProfiles,
  applicationInstitutions,
  applicationStatusEvents,
  applications,
  deliberationResults,
  deliberationRuns,
  demographicProfiles,
  educationRecords,
  feePayments,
  institutions,
  parameters,
  programChoices,
  programs,
  tuitionPaymentReviews,
  users,
} from "@/server/db/schema";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/server/http/errors";
import { loadTuitionAccounts } from "@/server/modules/tuition/tuition.service";
import { loadMedicalRecords } from "@/server/modules/medical/medical.service";
import { listRows as matriculationRows } from "@/server/modules/matriculation/matriculation.service";

/**
 * Reports, built from the database for the person asking:
 *
 *   Cheeta administration  every institution (?institutionId= to narrow)
 *   institution staff      their institution only, and only applications
 *                          that have been submitted. A student whose
 *                          payment isn't approved yet shows only as a
 *                          masked name, with the details blanked here on
 *                          the server, not just hidden on screen.
 *
 * Student registration is administration's report only.
 *
 * Every report takes the same query:
 *   ?q=             search the report's text fields
 *   ?from= &to=     date range (YYYY-MM-DD, inclusive) on the report's date
 *   ?sort= &dir=    any of the report's sort keys, asc or desc
 *   ?<filter>=      any of the report's filters (listed in the answer)
 *   ?page= &pageSize=  up to 5000 rows a page
 *   ?format=csv     the filtered, sorted rows as a CSV file
 */

type Val = string | number | null;
type Row = Record<string, unknown> & { id: string; masked: boolean; maskedName: string };

interface Report<R extends Row> {
  key: ReportKey;
  title: string;
  rows(db: Executor, institutionId: string | null): Promise<R[]>;
  /** The date the range applies to. */
  date: (r: R) => string | null;
  search: (r: R) => (string | null | undefined)[];
  filters: Record<string, (r: R, v: string) => boolean>;
  sorts: Record<string, (r: R) => Val>;
  defaultSort: { key: string; dir: "asc" | "desc" };
  csv: [string, (r: R) => Val][];
}

const DAY = 86_400_000;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const days = (from: Date | string, to: Date | string | number) => Math.max(0, Math.round(((typeof to === "number" ? to : new Date(to).getTime()) - new Date(from).getTime()) / DAY));
const lbl = (map: Map<string, string>, v: string | null | undefined) => (v ? map.get(v) ?? v : "");

async function paramLabels(db: Executor) {
  const rows = await db.select({ id: parameters.id, label: parameters.label }).from(parameters);
  return new Map(rows.map((r) => [r.id, r.label]));
}

// ---------------------------------------------------------------------------
// Applications, shared by most reports
// ---------------------------------------------------------------------------

interface AppRow extends Row {
  reference: string;
  student: string;
  registrationNo: string;
  institutionId: string;
  institution: string;
  program: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  feeState: "NONE" | "AWAITING" | "APPROVED" | "REJECTED";
  history: { status: ApplicationStatus; at: string; note: string; actor: string }[];
}

async function loadApplications(db: Executor, institutionId: string | null): Promise<AppRow[]> {
  const rows = await db
    .select({
      ai: applicationInstitutions,
      createdAt: applications.createdAt,
      student: users.fullName,
      registrationNo: applicantProfiles.registrationNo,
      institution: institutions.name,
    })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .where(
      and(
        institutionId ? eq(applicationInstitutions.institutionId, institutionId) : undefined,
        // An institution only ever sees applications once they are submitted.
        institutionId ? notInArray(applicationInstitutions.status, EDITABLE_STATUSES) : undefined
      )
    );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.ai.id);
  const [events, fees, choices, admitted] = await Promise.all([
    db.select().from(applicationStatusEvents).where(inArray(applicationStatusEvents.applicationInstitutionId, ids)).orderBy(asc(applicationStatusEvents.at)),
    db.select({ id: feePayments.applicationInstitutionId, approval: feePayments.approval, at: feePayments.createdAt }).from(feePayments).where(inArray(feePayments.applicationInstitutionId, ids)).orderBy(desc(feePayments.createdAt)),
    db.select({ id: programChoices.applicationInstitutionId, rank: programChoices.rank, name: programs.name }).from(programChoices).innerJoin(programs, eq(programs.id, programChoices.programId)).where(inArray(programChoices.applicationInstitutionId, ids)),
    db.select({ id: admissions.applicationInstitutionId, name: programs.name }).from(admissions).innerJoin(programs, eq(programs.id, admissions.programId)).where(inArray(admissions.applicationInstitutionId, ids)),
  ]);
  return rows.map((r) => {
    const fee = fees.find((f) => f.id === r.ai.id);
    let feeState: AppRow["feeState"] = !fee ? "NONE" : (fee.approval as AppRow["feeState"]);
    // An institution only learns of a payment once it is approved.
    if (institutionId && feeState !== "APPROVED") feeState = fee ? "AWAITING" : "NONE";
    const masked = !!institutionId && feeState !== "APPROVED";
    const history = events.filter((e) => e.applicationInstitutionId === r.ai.id).map((e) => ({ status: e.status as ApplicationStatus, at: e.at.toISOString(), note: e.note, actor: e.actor }));
    const program = admitted.find((a) => a.id === r.ai.id)?.name ?? choices.filter((c) => c.id === r.ai.id).sort((a, b) => a.rank - b.rank)[0]?.name ?? "";
    const row: AppRow = {
      id: r.ai.id,
      masked,
      maskedName: maskFullName(r.student),
      reference: r.ai.applicationNumber ?? r.ai.reference,
      student: r.student,
      registrationNo: r.registrationNo ?? "",
      institutionId: r.ai.institutionId,
      institution: r.institution,
      program,
      status: r.ai.status as ApplicationStatus,
      createdAt: r.createdAt.toISOString(),
      updatedAt: (history[history.length - 1]?.at ?? r.ai.updatedAt.toISOString()),
      submittedAt: iso(r.ai.submittedAt),
      feeState,
      history,
    };
    return mask(row, ["student", "registrationNo", "reference"]);
  });
}

/** Blanks what a masked row must not show; the masked name stands in for the student. */
function mask<R extends Row>(r: R, fields: (keyof R)[]): R {
  if (!r.masked) return r;
  const out = { ...r } as Record<string, unknown>;
  for (const f of fields) out[f as string] = f === "student" ? r.maskedName : typeof r[f] === "number" ? 0 : "";
  return out as R;
}

const appSearch = (r: AppRow) => [r.student, r.registrationNo, r.reference, r.program, r.institution];
const appSorts = { student: (r: AppRow) => r.student, reference: (r: AppRow) => r.reference, institution: (r: AppRow) => r.institution, program: (r: AppRow) => r.program };
const appFilters = { inst: (r: { institutionId: string }, v: string) => r.institutionId === v };
const appCsv: [string, (r: AppRow) => Val][] = [
  ["Student", (r) => r.student],
  ["Registration no.", (r) => r.registrationNo],
  ["Application", (r) => r.reference],
  ["Institution", (r) => r.institution],
  ["Program", (r) => r.program],
];

// ---------------------------------------------------------------------------
// The reports
// ---------------------------------------------------------------------------

const registration: Report<Row & { name: string; registrationNo: string; email: string; gender: string; region: string; regionId: string; town: string; qualification: string; source: string; registeredAt: string; applications: number }> = {
  key: "student-registration",
  title: "Student registration",
  async rows(db) {
    const [rows, labels, apps, edu] = await Promise.all([
      db
        .select({ u: users, regNo: applicantProfiles.registrationNo, d: demographicProfiles })
        .from(users)
        .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
        .leftJoin(demographicProfiles, eq(demographicProfiles.userId, users.id))
        .where(eq(users.role, "STUDENT")),
      paramLabels(db),
      db
        .select({ id: applications.applicantId, n: sql<number>`count(${applicationInstitutions.id})::int` })
        .from(applications)
        .leftJoin(applicationInstitutions, eq(applicationInstitutions.applicationId, applications.id))
        .groupBy(applications.applicantId),
      db.select({ userId: educationRecords.userId, qualification: educationRecords.qualification, endYear: educationRecords.endYear }).from(educationRecords).orderBy(desc(educationRecords.endYear)),
    ]);
    return rows.map(({ u, regNo, d }) => ({
      id: u.id,
      masked: false,
      maskedName: "",
      name: u.fullName,
      registrationNo: regNo ?? "",
      email: u.email,
      gender: d?.sex ?? "",
      region: lbl(labels, d?.regionOfOrigin),
      regionId: d?.regionOfOrigin ?? "",
      town: lbl(labels, d?.townOfResidence),
      qualification: edu.find((e) => e.userId === u.id)?.qualification ?? "",
      // Students register themselves; an account without an applicant profile was made by an administrator.
      source: regNo ? "Self-registered" : "Registered by admin",
      registeredAt: u.createdAt.toISOString(),
      applications: apps.find((a) => a.id === u.id)?.n ?? 0,
    }));
  },
  date: (r) => r.registeredAt,
  search: (r) => [r.name, r.registrationNo, r.email, r.town],
  filters: {
    gender: (r, v) => r.gender === v,
    region: (r, v) => r.regionId === v,
    source: (r, v) => r.source === v,
    apps: (r, v) => (v === "none" ? r.applications === 0 : r.applications > 0),
  },
  sorts: { name: (r) => r.name, regno: (r) => r.registrationNo, gender: (r) => r.gender, region: (r) => r.region, town: (r) => r.town, qual: (r) => r.qualification, source: (r) => r.source, registered: (r) => r.registeredAt, apps: (r) => r.applications },
  defaultSort: { key: "registered", dir: "desc" },
  csv: [["Student", (r) => r.name], ["Registration no.", (r) => r.registrationNo], ["Email", (r) => r.email], ["Gender", (r) => r.gender], ["Region", (r) => r.region], ["Town", (r) => r.town], ["Qualification", (r) => r.qualification], ["Source", (r) => r.source], ["Registered", (r) => r.registeredAt], ["Applications", (r) => r.applications]],
};

const applicationsReport: Report<AppRow> = {
  key: "applications",
  title: "Applications",
  rows: loadApplications,
  date: (r) => r.createdAt,
  search: appSearch,
  filters: { ...appFilters, status: (r, v) => r.status === v, fee: (r, v) => r.feeState === v },
  sorts: { ...appSorts, status: (r) => r.status, fee: (r) => r.feeState, created: (r) => r.createdAt, updated: (r) => r.updatedAt },
  defaultSort: { key: "updated", dir: "desc" },
  csv: [...appCsv, ["Status", (r) => ADMIN_STATUS_LABELS[r.status] ?? r.status], ["Application fee", (r) => r.feeState], ["Started", (r) => r.createdAt], ["Last change", (r) => r.updatedAt]],
};

type ProgRow = AppRow & { app: { status: ApplicationStatus; history: AppRow["history"]; payment: { status: "PAID" | "PENDING" } | null }; reached: number; current: StageKey; currentLabel: string; final: boolean; daysInStage: number; daysTotal: number };
const progression: Report<ProgRow> = {
  key: "application-progression",
  title: "Application progression",
  async rows(db, inst) {
    const now = Date.now();
    return (await loadApplications(db, inst)).map((a) => {
      const app = { status: a.status, history: a.history, payment: a.feeState === "APPROVED" ? { status: "PAID" as const } : a.feeState === "NONE" ? null : { status: "PENDING" as const } };
      const reached = reachedStages(app);
      const current = [...STAGES].reverse().find((s) => reached.has(s.key))!.key;
      const last = a.history[a.history.length - 1]?.at ?? a.createdAt;
      const final = ["I_REJECTED", "A_ACKNOWLEDGED", "A_REJECTED"].includes(a.status);
      return { ...a, app, reached: reached.size, current, currentLabel: stageLabel(current), final, daysInStage: days(last, now), daysTotal: days(a.createdAt, final ? last : now) };
    });
  },
  date: (r) => r.createdAt,
  search: appSearch,
  filters: { ...appFilters, stage: (r, v) => r.current === v, stalled: (r, v) => (v === "final" ? r.final : v === "stalled" ? !r.final && r.daysInStage > 14 : !r.final && r.daysInStage <= 14) },
  sorts: { ...appSorts, track: (r) => r.reached, current: (r) => r.reached, inStage: (r) => (r.final ? -1 : r.daysInStage), total: (r) => r.daysTotal, created: (r) => r.createdAt },
  defaultSort: { key: "inStage", dir: "desc" },
  csv: [...(appCsv as [string, (r: ProgRow) => Val][]), ["Current stage", (r) => r.currentLabel], ["Stages reached", (r) => r.reached], ["Days in stage", (r) => (r.final ? "" : r.daysInStage)], ["Days total", (r) => r.daysTotal]],
};

type PayRow = Row & { kind: "Application fee" | "Tuition"; student: string; reference: string; institutionId: string; institution: string; program: string; method: string; paymentRef: string; institutionAmount: number; webFee: number; total: number; currency: string; state: "AWAITING" | "APPROVED" | "REJECTED"; bankCode: string; recordedAt: string; approvedAt: string | null };
const payments: Report<PayRow> = {
  key: "payments",
  title: "Payments",
  async rows(db, inst) {
    const [labels, apps] = await Promise.all([paramLabels(db), loadApplications(db, null)]);
    const byId = new Map(apps.map((a) => [a.id, a]));
    const fees = await db.select().from(feePayments).where(inst ? sql`${feePayments.applicationInstitutionId} IN (SELECT id FROM application_institutions WHERE institution_id = ${inst})` : undefined);
    const out: PayRow[] = [];
    for (const f of fees) {
      const a = byId.get(f.applicationInstitutionId);
      if (!a) continue;
      if (inst && EDITABLE_STATUSES.includes(a.status) && f.approval !== "APPROVED") continue;
      const state = (inst && f.approval === "REJECTED" ? "AWAITING" : f.approval) as PayRow["state"];
      const masked = !!inst && f.approval !== "APPROVED";
      out.push(
        mask(
          {
            id: f.id,
            masked,
            maskedName: a.maskedName,
            kind: "Application fee",
            student: a.student,
            reference: a.reference,
            institutionId: a.institutionId,
            institution: a.institution,
            program: a.program,
            method: inst ? "" : lbl(labels, f.method),
            paymentRef: inst ? "" : f.reference,
            // An institution sees its own fee, never the platform's web fee.
            institutionAmount: f.applicationFee,
            webFee: inst ? 0 : f.webFee,
            total: inst ? f.applicationFee : f.amount,
            currency: f.currency,
            state,
            bankCode: f.bankCode ?? "",
            recordedAt: f.createdAt.toISOString(),
            approvedAt: f.approval === "APPROVED" ? iso(f.reviewedAt) : null,
          },
          ["student", "reference", "institutionAmount", "total", "bankCode", "program"]
        )
      );
    }
    const accounts = await loadTuitionAccounts(db, inst ? eq(applicationInstitutions.institutionId, inst) : undefined, "admin");
    const verifiedAt = await db.select({ id: tuitionPaymentReviews.paymentId, at: tuitionPaymentReviews.at }).from(tuitionPaymentReviews).where(eq(tuitionPaymentReviews.action, "VERIFIED")).orderBy(desc(tuitionPaymentReviews.at));
    for (const acc of accounts) {
      for (const p of acc.payments) {
        // Rejected tuition payments are between Cheeta and the student.
        if (inst && p.status === "REJECTED") continue;
        const state: PayRow["state"] = p.status === "VERIFIED" ? "APPROVED" : p.status === "REJECTED" ? "REJECTED" : "AWAITING";
        out.push(
          mask(
            {
              id: p.id,
              masked: !!inst && state === "AWAITING",
              maskedName: maskFullName(acc.studentName),
              kind: "Tuition",
              student: acc.studentName,
              reference: acc.applicationRef,
              institutionId: acc.institutionId,
              institution: acc.institutionName,
              program: acc.programName,
              method: inst ? "" : p.methodLabel ?? "",
              paymentRef: inst ? "" : p.reference,
              institutionAmount: p.amount,
              webFee: 0,
              total: p.amount,
              currency: acc.currency,
              state,
              bankCode: p.bankCode ?? "",
              recordedAt: p.recordedAt,
              approvedAt: p.status === "VERIFIED" ? iso(verifiedAt.find((v) => v.id === p.id)?.at ?? (p as { verifiedAt?: string | null }).verifiedAt) : null,
            },
            ["student", "reference", "institutionAmount", "total", "bankCode", "program"]
          )
        );
      }
    }
    return out;
  },
  date: (r) => r.recordedAt,
  search: (r) => [r.student, r.reference, r.paymentRef, r.bankCode, r.program],
  filters: { ...appFilters, kind: (r, v) => r.kind === v || (v === "fee" && r.kind === "Application fee") || (v === "tuition" && r.kind === "Tuition"), state: (r, v) => r.state === v, method: (r, v) => r.method === v },
  sorts: { student: (r) => r.student, kind: (r) => r.kind, institution: (r) => r.institution, method: (r) => r.method, ref: (r) => r.paymentRef, amount: (r) => r.institutionAmount, web: (r) => r.webFee, total: (r) => r.total, state: (r) => r.state, code: (r) => r.bankCode, recorded: (r) => r.recordedAt, approved: (r) => r.approvedAt ?? "" },
  defaultSort: { key: "recorded", dir: "desc" },
  csv: [["Student", (r) => r.student], ["Application", (r) => r.reference], ["For", (r) => r.kind], ["Institution", (r) => r.institution], ["Program", (r) => r.program], ["Method", (r) => r.method], ["Payment reference", (r) => r.paymentRef], ["Institution amount", (r) => r.institutionAmount], ["Web fee", (r) => r.webFee], ["Total", (r) => r.total], ["Currency", (r) => r.currency], ["State", (r) => r.state], ["Bank code", (r) => r.bankCode], ["Recorded", (r) => r.recordedAt], ["Approved", (r) => r.approvedAt]],
};

type EventRow = AppRow & { by: string; byKey: string; at: string; reason?: string; daysFromSubmission: number };
function eventReport(key: "acknowledged-applications" | "rejected-applications", statuses: [ApplicationStatus, string][]): Report<EventRow> {
  return {
    key,
    title: key === "acknowledged-applications" ? "Acknowledged applications" : "Rejected applications",
    async rows(db, inst) {
      return (await loadApplications(db, inst)).flatMap((a) =>
        a.history
          .filter((h) => statuses.some(([s]) => s === h.status))
          .map((h) => ({
            ...a,
            id: `${a.id}-${h.status}-${h.at}`,
            by: statuses.find(([s]) => s === h.status)![1],
            byKey: h.status,
            at: h.at,
            reason: h.note,
            daysFromSubmission: days(a.history.find((x) => x.status === "SUBMITTED")?.at ?? a.createdAt, h.at),
          }))
      );
    },
    date: (r) => r.at,
    search: (r) => [...appSearch(r), r.reason],
    filters: { ...appFilters, by: (r, v) => r.byKey === v },
    sorts: { ...appSorts, by: (r) => r.by, at: (r) => r.at, days: (r) => r.daysFromSubmission, reason: (r) => r.reason ?? "" },
    defaultSort: { key: "at", dir: "desc" },
    csv: [...(appCsv as [string, (r: EventRow) => Val][]), ["By", (r) => r.by], ["Date", (r) => r.at], ["Days from submission", (r) => r.daysFromSubmission], ...(key === "rejected-applications" ? ([["Reason", (r: EventRow) => r.reason ?? ""]] as [string, (r: EventRow) => Val][]) : [])],
  };
}

type DelibRow = AppRow & { session: string | null; rule: string; score: number | null; choice: number | null; outcome: "ADMITTED" | "NOT_ADMITTED" | "PENDING"; acknowledgedAt: string; runNumber: number | null; failedAt: string | null; note: string };
const deliberation: Report<DelibRow> = {
  key: "deliberation",
  title: "Deliberation",
  async rows(db, inst) {
    const apps = (await loadApplications(db, inst)).filter((a) => a.history.some((h) => h.status === "I_ACKNOWLEDGED"));
    if (!apps.length) return [];
    // Each applicant's result in the latest run that included them.
    const results = await db
      .select({ r: deliberationResults, run: deliberationRuns.runNumber, runAt: deliberationRuns.createdAt, runStatus: deliberationRuns.status, rankBy: deliberationRuns.rankBy })
      .from(deliberationResults)
      .innerJoin(deliberationRuns, eq(deliberationRuns.id, deliberationResults.deliberationRunId))
      .where(inArray(deliberationResults.applicationInstitutionId, apps.map((a) => a.id)))
      .orderBy(desc(deliberationRuns.runNumber));
    return apps.map((a) => {
      const res = results.find((x) => x.r.applicationInstitutionId === a.id);
      return {
        ...a,
        session: iso(res?.runAt),
        rule: res ? `Run ${res.run}${res.runStatus === "PUBLISHED" ? " (published)" : ""}${res.rankBy ? `, ranked by ${String(res.rankBy).split(":").pop()}` : ""}` : "Not deliberated yet",
        score: res?.r.merit != null ? Number(res.r.merit) : null,
        choice: res?.r.choice ?? null,
        outcome: !res ? "PENDING" : res.r.outcome === "ACCEPTED" ? "ADMITTED" : "NOT_ADMITTED",
        acknowledgedAt: a.history.find((h) => h.status === "I_ACKNOWLEDGED")!.at,
        runNumber: res?.run ?? null,
        failedAt: res?.r.failedAt ?? null,
        note: res?.r.note ?? "",
      };
    });
  },
  date: (r) => r.session ?? r.acknowledgedAt,
  search: (r) => [...appSearch(r), r.note],
  filters: { ...appFilters, outcome: (r, v) => r.outcome === v, rule: (r, v) => r.rule === v, run: (r, v) => String(r.runNumber ?? "") === v },
  sorts: { ...appSorts, session: (r) => r.session ?? "", rule: (r) => r.rule, score: (r) => r.score ?? -1, choice: (r) => r.choice ?? 0, outcome: (r) => r.outcome, acknowledged: (r) => r.acknowledgedAt },
  defaultSort: { key: "session", dir: "desc" },
  csv: [...(appCsv as [string, (r: DelibRow) => Val][]), ["Run", (r) => r.runNumber], ["Session", (r) => r.session], ["Outcome", (r) => r.outcome], ["Choice", (r) => r.choice], ["Merit", (r) => r.score], ["Stopped at", (r) => r.failedAt], ["Reason", (r) => r.note]],
};

type AdmRow = AppRow & { admissionNumber: string; offeredAt: string; response: "AWAITING" | "TAKEN_UP" | "DECLINED"; respondedAt: string | null; daysToRespond: number };
const admission: Report<AdmRow> = {
  key: "admission",
  title: "Admission",
  async rows(db, inst) {
    const apps = await loadApplications(db, inst);
    const byId = new Map(apps.map((a) => [a.id, a]));
    const adms = await db
      .select({ a: admissions, program: programs.name })
      .from(admissions)
      .innerJoin(programs, eq(programs.id, admissions.programId))
      .where(inst ? eq(admissions.institutionId, inst) : undefined);
    const now = Date.now();
    return adms
      .filter((x) => byId.has(x.a.applicationInstitutionId))
      .map(({ a: adm, program }) => {
        const a = byId.get(adm.applicationInstitutionId)!;
        const offered = iso(adm.offeredAt ?? adm.createdAt)!;
        return {
          ...a,
          program,
          admissionNumber: adm.admissionNumber ?? "",
          offeredAt: offered,
          response: adm.status === "ACCEPTED" ? "TAKEN_UP" : adm.status === "REJECTED" ? "DECLINED" : "AWAITING",
          respondedAt: iso(adm.respondedAt),
          daysToRespond: days(offered, adm.respondedAt ?? now),
        };
      });
  },
  date: (r) => r.offeredAt,
  search: (r) => [...appSearch(r), r.admissionNumber],
  filters: { ...appFilters, response: (r, v) => r.response === v },
  sorts: { ...appSorts, number: (r) => r.admissionNumber, offered: (r) => r.offeredAt, response: (r) => r.response, responded: (r) => r.respondedAt ?? "", days: (r) => r.daysToRespond },
  defaultSort: { key: "offered", dir: "desc" },
  csv: [...(appCsv as [string, (r: AdmRow) => Val][]), ["Admission no.", (r) => r.admissionNumber], ["Offered", (r) => r.offeredAt], ["Response", (r) => r.response], ["Responded", (r) => r.respondedAt], ["Days to respond", (r) => r.daysToRespond]],
};

type TuiRow = Row & { student: string; registrationNo: string; institutionId: string; institution: string; program: string; category: string; currency: string; tuition: number; verified: number; awaiting: number; outstanding: number; paymentStatus: string; verificationStatus: string; institutionState: string; toReconcile: number; admittedAt: string };
const tuition: Report<TuiRow> = {
  key: "tuition",
  title: "Tuition",
  async rows(db, inst) {
    const labels = await paramLabels(db);
    const accounts = await loadTuitionAccounts(db, inst ? eq(applicationInstitutions.institutionId, inst) : undefined, "admin");
    return accounts.map((a) => {
      const v = institutionTuitionView(a);
      const f = a.figures;
      const row: TuiRow = {
        id: a.id,
        masked: !!inst && v.masked,
        maskedName: v.displayName,
        student: a.studentName,
        registrationNo: a.registrationNo,
        institutionId: a.institutionId,
        institution: a.institutionName,
        program: a.programName,
        category: lbl(labels, a.feeCategoryId),
        currency: a.currency,
        tuition: a.tuitionAmount,
        verified: f.verified,
        // What is awaiting verification is between Cheeta and the student.
        awaiting: inst ? 0 : f.awaiting,
        outstanding: f.outstanding,
        paymentStatus: f.paymentStatus,
        verificationStatus: inst ? "" : f.verificationStatus,
        institutionState: v.state,
        toReconcile: v.toReconcile,
        admittedAt: a.admittedAt,
      };
      return mask(row, ["student", "registrationNo", "program", "tuition", "verified", "outstanding", "paymentStatus"]);
    });
  },
  date: (r) => r.admittedAt,
  search: (r) => [r.student, r.registrationNo, r.program],
  filters: { ...appFilters, payment: (r, v) => r.paymentStatus === v, verification: (r, v) => r.verificationStatus === v, state: (r, v) => r.institutionState === v, category: (r, v) => r.category === v, reconcile: (r, v) => (v === "to-reconcile" ? r.toReconcile > 0 : r.toReconcile === 0) },
  sorts: { student: (r) => r.student, institution: (r) => r.institution, program: (r) => r.program, category: (r) => r.category, tuition: (r) => r.tuition, verified: (r) => r.verified, awaiting: (r) => r.awaiting, outstanding: (r) => r.outstanding, payment: (r) => r.paymentStatus, verification: (r) => r.verificationStatus, admitted: (r) => r.admittedAt },
  defaultSort: { key: "outstanding", dir: "desc" },
  csv: [["Student", (r) => r.student], ["Registration no.", (r) => r.registrationNo], ["Institution", (r) => r.institution], ["Program", (r) => r.program], ["Category", (r) => r.category], ["Currency", (r) => r.currency], ["Tuition", (r) => r.tuition], ["Verified", (r) => r.verified], ["Awaiting verification", (r) => r.awaiting], ["Outstanding", (r) => r.outstanding], ["Tuition status", (r) => r.paymentStatus], ["Verification", (r) => r.verificationStatus], ["Admitted", (r) => r.admittedAt]],
};

type MedRow = Row & Awaited<ReturnType<typeof loadMedicalRecords>>[number] & { institution: string };
const medical: Report<MedRow> = {
  key: "medical-verification",
  title: "Medical verification",
  async rows(db, inst) {
    const recs = await loadMedicalRecords(db, inst ? eq(applicationInstitutions.institutionId, inst) : undefined, "staff");
    return recs.map((r) => ({ ...r, masked: false, maskedName: "", institution: r.institutionName, history: [] }));
  },
  date: (r) => r.verificationDate,
  search: (r) => [r.studentName, r.registrationNo, r.applicationRef, r.certificateRef, r.programName, r.verifiedBy],
  filters: { ...appFilters, requirement: (r, v) => r.requirementCode === v, status: (r, v) => r.status === v, result: (r, v) => (v === "none" ? !r.result : r.result === v), required: (r, v) => (v === "required") === r.required },
  sorts: { student: (r) => r.studentName, institution: (r) => r.institution, program: (r) => r.programName, requirement: (r) => r.requirementLabel, status: (r) => r.status, result: (r) => r.result ?? "", date: (r) => r.verificationDate ?? "", verifier: (r) => r.verifiedBy ?? "" },
  defaultSort: { key: "date", dir: "desc" },
  csv: [["Student", (r) => r.studentName], ["Registration no.", (r) => r.registrationNo], ["Institution", (r) => r.institution], ["Program", (r) => r.programName], ["Requirement", (r) => r.requirementLabel], ["Required", (r) => (r.required ? "Yes" : "No")], ["Status", (r) => r.status], ["Result", (r) => r.result], ["Verification date", (r) => r.verificationDate], ["Verified by", (r) => r.verifiedBy], ["Centre", (r) => r.centre], ["Certificate ref.", (r) => r.certificateRef]],
};

type MatRow = Row & { student: string; registrationNo: string; institutionId: string; institution: string; program: string; admission: string; tuition: string; medical: string; status: string; code: string; matriculatedAt: string | null; admittedAt: string };
const matriculation: Report<MatRow> = {
  key: "matriculation",
  title: "Matriculation",
  async rows(db, inst) {
    // The same rows (and masking) as the matriculation screens.
    const user = (inst ? { role: "INSTITUTION_ADMIN", institutionId: inst } : { role: "AOSA_ADMIN" }) as PublicUser;
    void db;
    return (await matriculationRows(user, inst)).map((r) => ({
      id: r.account.id,
      masked: !!inst && r.maskedForInstitution,
      maskedName: r.account.studentName,
      student: r.account.studentName,
      registrationNo: r.account.registrationNo,
      institutionId: r.account.institutionId,
      institution: r.account.institutionName,
      program: r.account.programName,
      admission: r.admission,
      tuition: r.tuition,
      medical: r.medical,
      status: r.status,
      code: r.record?.code ?? "",
      matriculatedAt: r.record?.matriculatedAt ?? null,
      admittedAt: r.account.admittedAt,
    }));
  },
  date: (r) => r.matriculatedAt ?? r.admittedAt,
  search: (r) => [r.student, r.registrationNo, r.program, r.code],
  filters: { ...appFilters, status: (r, v) => r.status === v, tuition: (r, v) => r.tuition === v, medical: (r, v) => r.medical === v, admission: (r, v) => r.admission === v },
  sorts: { student: (r) => r.student, institution: (r) => r.institution, program: (r) => r.program, admission: (r) => r.admission, tuition: (r) => r.tuition, medical: (r) => r.medical, status: (r) => r.status, code: (r) => r.code, matriculated: (r) => r.matriculatedAt ?? "", admitted: (r) => r.admittedAt },
  defaultSort: { key: "matriculated", dir: "desc" },
  csv: [["Student", (r) => r.student], ["Registration no.", (r) => r.registrationNo], ["Institution", (r) => r.institution], ["Program", (r) => r.program], ["Admission", (r) => r.admission], ["Tuition", (r) => r.tuition], ["Medical", (r) => r.medical], ["Status", (r) => r.status], ["Matriculation code", (r) => r.code], ["Matriculated", (r) => r.matriculatedAt]],
};

const REPORTS: Record<ReportKey, Report<Row>> = {
  "student-registration": registration as unknown as Report<Row>,
  applications: applicationsReport as unknown as Report<Row>,
  "application-progression": progression as unknown as Report<Row>,
  payments: payments as unknown as Report<Row>,
  "acknowledged-applications": eventReport("acknowledged-applications", [["I_ACKNOWLEDGED", "Institution"], ["A_ACKNOWLEDGED", "Applicant (offer taken up)"]]) as unknown as Report<Row>,
  "rejected-applications": eventReport("rejected-applications", [["I_REJECTED", "Institution"], ["A_REJECTED", "Applicant (declined offer)"]]) as unknown as Report<Row>,
  deliberation: deliberation as unknown as Report<Row>,
  admission: admission as unknown as Report<Row>,
  tuition: tuition as unknown as Report<Row>,
  "medical-verification": medical as unknown as Report<Row>,
  matriculation: matriculation as unknown as Report<Row>,
};

// ---------------------------------------------------------------------------
// Running a report
// ---------------------------------------------------------------------------

const RESERVED = new Set(["q", "from", "to", "sort", "dir", "page", "pageSize", "format", "institutionId"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Start of a calendar day in Cameroon (UTC+1), as an ISO instant. */
const dayStart = (d: string) => new Date(`${d}T00:00:00+01:00`).toISOString();

function scopeOf(user: PublicUser, key: ReportKey, requested: string | null): string | null {
  if (user.role === "AOSA_ADMIN") return requested;
  if (user.role !== "INSTITUTION_ADMIN" && user.role !== "INSTITUTION_ADMISSION_USER") throw new ForbiddenError();
  if (!reportsFor("institution").includes(key)) throw new ForbiddenError("This report is for Cheeta administration only.");
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

/** The reports this person can run, with each one's filters and sort keys. */
export function listReports(user: PublicUser) {
  const scope = user.role === "AOSA_ADMIN" ? "admin" : "institution";
  return reportsFor(scope).map((k) => ({ key: k, title: REPORTS[k].title, filters: Object.keys(REPORTS[k].filters), sorts: Object.keys(REPORTS[k].sorts), defaultSort: REPORTS[k].defaultSort }));
}

export async function runReport(user: PublicUser, key: string, req: NextRequest) {
  if (!isReportKey(key)) throw new NotFoundError("Report");
  const def = REPORTS[key];
  const p = req.nextUrl.searchParams;
  const institutionId = scopeOf(user, key, p.get("institutionId"));

  const from = p.get("from");
  const to = p.get("to");
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) throw new BadRequestError("Dates are YYYY-MM-DD.", { field: from && !DATE.test(from) ? "from" : "to" });
  if (from && to && from > to) throw new BadRequestError("The start of the range is after its end.", { field: "from" });
  const sortKey = p.get("sort") ?? def.defaultSort.key;
  if (!def.sorts[sortKey]) throw new BadRequestError(`Sort by one of: ${Object.keys(def.sorts).join(", ")}.`, { field: "sort" });
  const dir = p.get("dir") ?? (p.get("sort") ? "asc" : def.defaultSort.dir);
  if (dir !== "asc" && dir !== "desc") throw new BadRequestError("Direction is asc or desc.", { field: "dir" });
  const filters: [string, string][] = [];
  for (const [k, v] of p.entries()) {
    if (RESERVED.has(k) || !v) continue;
    if (!def.filters[k] || (k === "inst" && user.role !== "AOSA_ADMIN")) throw new BadRequestError(`Unknown filter "${k}". This report filters by: ${Object.keys(def.filters).filter((f) => f !== "inst" || user.role === "AOSA_ADMIN").join(", ")}.`, { field: k });
    filters.push([k, v]);
  }
  const page = Math.max(1, Number(p.get("page") ?? 1) || 1);
  const pageSize = Math.min(5000, Math.max(1, Number(p.get("pageSize") ?? 100) || 100));

  const all = await def.rows(getDb(), institutionId);
  const start = from ? dayStart(from) : null;
  const end = to ? new Date(new Date(dayStart(to)).getTime() + DAY).toISOString() : null;
  const words = (p.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter((r) => {
    if (start || end) {
      const d = def.date(r);
      if (!d || (start && d < start) || (end && d >= end)) return false;
    }
    if (words.length) {
      // A masked row can only be found by its masked name.
      const hay = (r.masked ? [r.maskedName] : def.search(r)).filter(Boolean).join(" ").toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return filters.every(([k, v]) => def.filters[k](r, v));
  });
  const get = def.sorts[sortKey];
  rows.sort((a, b) => {
    const x = get(a) ?? "";
    const y = get(b) ?? "";
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return dir === "asc" ? c : -c;
  });

  if (p.get("format") === "csv") {
    const esc = (v: Val) => {
      const s = v === null || v === undefined ? "" : String(v);
      // A cell starting with = + - @ would run as a formula in a spreadsheet.
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [def.csv.map(([h]) => esc(h)).join(","), ...rows.map((r) => def.csv.map(([, f]) => esc(f(r))).join(","))];
    return { csv: lines.join("\n"), filename: `${key}-${new Date().toISOString().slice(0, 10)}.csv` };
  }

  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: rows.length, unfiltered: all.length },
    query: { q: p.get("q") ?? "", from, to, sort: sortKey, dir, filters: Object.fromEntries(filters), institutionId },
    available: { filters: Object.keys(def.filters).filter((f) => f !== "inst" || user.role === "AOSA_ADMIN"), sorts: Object.keys(def.sorts) },
  };
}

