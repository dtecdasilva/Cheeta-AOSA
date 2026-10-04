"use client";

import { ToneBadge, StageTrack, AdminStatusBadge } from "@/components/admin/ui";
import { ADMIN_STATUS_LABELS, ALL_STATUSES, STAGES } from "@/lib/admin/status";
import { FEE_APPROVAL_META } from "@/lib/payments/applicationFees";
import { INSTITUTION_TUITION_META, PAYMENT_STATUS_META, VERIFICATION_META } from "@/lib/tuition/data";
import { CLEARANCE_META, MEDICAL_REQUIREMENTS, MEDICAL_RESULT_META, MEDICAL_STATUS_META, requirementLabel } from "@/lib/medical/data";
import { ADMISSION_META, MATRIC_STATUS_META, TUITION_CLEARANCE_META } from "@/lib/matriculation/data";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Column, FilterDef, ReportDef, Scope } from "./ReportScreen";
import * as src from "./sources";

type Row<F extends (...a: never[]) => unknown[]> = ReturnType<F>[number];
type Tone = "neutral" | "info" | "amber" | "success" | "danger";

const money = (n: number) => formatCurrency(n);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const badge = (m: { label: string; tone: Tone }) => <ToneBadge tone={m.tone}>{m.label}</ToneBadge>;
const opts = (rec: Record<string, { label: string }>) => Object.entries(rec).map(([value, m]) => ({ value, label: m.label }));
const uniq = <T,>(rows: T[], get: (r: T) => string, label: (r: T) => string = get) =>
  [...new Map(rows.map((r) => [get(r), label(r)])).entries()].map(([value, l]) => ({ value, label: l })).sort((a, b) => a.label.localeCompare(b.label));

/** Columns and filters most application-based reports share. */
function appColumns<R extends { reference: string; student: string; registrationNo: string; institution: string; program: string }>(): Column<R>[] {
  return [
    {
      key: "student",
      label: "Student",
      sort: (r) => r.student,
      text: (r) => r.student,
      render: (r) => (
        <>
          <p className="text-[var(--color-ink)]">{r.student}</p>
          <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.reference}</p>
        </>
      ),
    },
    { key: "reference", label: "Application", sort: (r) => r.reference, text: (r) => r.reference, render: (r) => <span className="whitespace-nowrap text-[var(--color-ink-soft)]">{r.reference}</span> },
    { key: "institution", label: "Institution", sort: (r) => r.institution, text: (r) => r.institution, adminOnly: true },
    { key: "program", label: "Program", sort: (r) => r.program, text: (r) => r.program },
  ];
}

function institutionFilter<R extends { institutionId: string; institution: string }>(rows: R[]): FilterDef<R> {
  return { key: "inst", label: "Institution", options: uniq(rows, (r) => r.institutionId, (r) => r.institution), test: (r, v) => r.institutionId === v, adminOnly: true };
}

const dateCol = <R,>(key: string, label: string, get: (r: R) => string | null): Column<R> => ({
  key,
  label,
  sort: (r) => get(r) ?? "",
  text: (r) => (get(r) ? formatDate(get(r)) : ""),
  render: (r) => <span className="whitespace-nowrap">{formatDate(get(r))}</span>,
});

// ---------------------------------------------------------------------------
// Definitions. Each is built against the rows it will show, so filter
// options come from the data actually present.
// ---------------------------------------------------------------------------

type Registration = Row<typeof src.registrationRows>;
function registration(rows: Registration[]): ReportDef<Registration> {
  return {
    key: "student-registration",
    title: "Student registration",
    description: "Every student registered on the platform, where they're from and whether they've applied.",
    noun: "students",
    dateLabel: "Registered",
    date: (r) => r.registeredAt,
    search: (r) => [r.name, r.registrationNo, r.email, r.town],
    adminOnly: true,
    defaultSort: { key: "registered", dir: "desc" },
    columns: [
      { key: "name", label: "Student", sort: (r) => r.name, text: (r) => r.name, render: (r) => (<><p className="text-[var(--color-ink)]">{r.name}</p><p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.registrationNo}</p></>) },
      { key: "regno", label: "Registration no.", sort: (r) => r.registrationNo, text: (r) => r.registrationNo, render: (r) => <span className="whitespace-nowrap text-[var(--color-ink-soft)]">{r.registrationNo}</span> },
      { key: "gender", label: "Gender", sort: (r) => r.gender, text: (r) => r.gender },
      { key: "region", label: "Region", sort: (r) => r.region, text: (r) => r.region },
      { key: "town", label: "Town", sort: (r) => r.town, text: (r) => r.town },
      { key: "qual", label: "Qualification", sort: (r) => r.qualification, text: (r) => r.qualification },
      { key: "source", label: "Source", sort: (r) => r.source, text: (r) => r.source },
      dateCol<Registration>("registered", "Registered", (r) => r.registeredAt),
      { key: "apps", label: "Applications", align: "right", sort: (r) => r.applications, text: (r) => String(r.applications) },
    ],
    filters: [
      { key: "gender", label: "Gender", options: [{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }], test: (r, v) => r.gender === v },
      { key: "region", label: "Region", options: uniq(rows, (r) => r.regionId, (r) => r.region), test: (r, v) => r.regionId === v },
      { key: "source", label: "Source", options: [{ value: "Self-registered", label: "Self-registered" }, { value: "Registered by admin", label: "Registered by admin" }], test: (r, v) => r.source === v },
      { key: "apps", label: "Applications", options: [{ value: "none", label: "No applications" }, { value: "some", label: "At least one" }], test: (r, v) => (v === "none" ? r.applications === 0 : r.applications > 0) },
    ],
    stats: (rs) => [
      { label: "Students", value: rs.length },
      { label: "Female", value: pct(rs.filter((r) => r.gender === "Female").length, rs.length) },
      { label: "Self-registered", value: pct(rs.filter((r) => r.source === "Self-registered").length, rs.length) },
      { label: "Not yet applied", value: rs.filter((r) => r.applications === 0).length },
    ],
  };
}

type Application = Row<typeof src.applicationRows>;
const FEE_STATE_LABEL: Record<string, { label: string; tone: Tone }> = {
  NONE: { label: "No payment", tone: "neutral" },
  AWAITING: { label: "Awaiting approval", tone: "info" },
  APPROVED: { label: "Paid", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};
function applications(rows: Application[]): ReportDef<Application> {
  return {
    key: "applications",
    title: "Applications",
    description: "Every application with its current status and whether its fee has been approved.",
    noun: "applications",
    dateLabel: "Started",
    date: (r) => r.createdAt,
    search: (r) => [r.student, r.reference, r.program, r.institution, r.registrationNo],
    defaultSort: { key: "updated", dir: "desc" },
    columns: [
      ...appColumns<Application>(),
      { key: "status", label: "Status", sort: (r) => r.status, text: (r) => ADMIN_STATUS_LABELS[r.status], render: (r) => <AdminStatusBadge status={r.status} /> },
      { key: "fee", label: "Application fee", sort: (r) => r.feeState, text: (r) => FEE_STATE_LABEL[r.feeState].label, render: (r) => badge(FEE_STATE_LABEL[r.feeState]) },
      dateCol<Application>("created", "Started", (r) => r.createdAt),
      dateCol<Application>("updated", "Last update", (r) => r.updatedAt),
    ],
    filters: [
      institutionFilter(rows),
      { key: "status", label: "Status", options: ALL_STATUSES.map((s) => ({ value: s, label: ADMIN_STATUS_LABELS[s] })), test: (r, v) => r.status === v },
      { key: "fee", label: "Application fee", options: Object.entries(FEE_STATE_LABEL).map(([value, m]) => ({ value, label: m.label })), test: (r, v) => r.feeState === v },
    ],
    stats: (rs) => [
      { label: "Applications", value: rs.length },
      { label: "Submitted", value: rs.filter((r) => !["INCOMPLETE", "COMPLETED"].includes(r.status)).length },
      { label: "Accepted", value: rs.filter((r) => ["ACCEPTED", "A_ACKNOWLEDGED", "A_REJECTED"].includes(r.status)).length },
      { label: "Rejected", value: rs.filter((r) => r.status === "I_REJECTED").length },
    ],
  };
}

type Progression = Row<typeof src.progressionRows>;
function progression(rows: Progression[]): ReportDef<Progression> {
  return {
    key: "application-progression",
    title: "Application progression",
    description: "How far each application has got through the seven stages, and how long it has sat in its current one.",
    noun: "applications",
    dateLabel: "Started",
    date: (r) => r.createdAt,
    search: (r) => [r.student, r.reference, r.program, r.institution],
    defaultSort: { key: "inStage", dir: "desc" },
    columns: [
      ...appColumns<Progression>(),
      { key: "track", label: "Stages", sort: (r) => r.reached, text: (r) => `${r.reached} of ${STAGES.length}`, render: (r) => (<span className="inline-flex items-center gap-2 whitespace-nowrap"><StageTrack app={r.app} compact /><span className="text-xs text-[var(--color-ink-faint)]">{r.reached}/{STAGES.length}</span></span>) },
      { key: "current", label: "Current stage", sort: (r) => r.reached, text: (r) => r.currentLabel },
      { key: "inStage", label: "Days in stage", align: "right", sort: (r) => (r.final ? -1 : r.daysInStage), text: (r) => (r.final ? "Finished" : String(r.daysInStage)), render: (r) => (r.final ? <span className="text-[var(--color-ink-faint)]">Finished</span> : <span className={r.daysInStage > 14 ? "text-[var(--color-danger)]" : undefined}>{r.daysInStage}</span>) },
      { key: "total", label: "Days total", align: "right", sort: (r) => r.daysTotal, text: (r) => String(r.daysTotal) },
    ],
    filters: [
      institutionFilter(rows),
      { key: "stage", label: "Current stage", options: STAGES.map((s) => ({ value: s.key, label: s.label })), test: (r, v) => r.current === v },
      { key: "stalled", label: "Movement", options: [{ value: "stalled", label: "Stalled over 14 days" }, { value: "moving", label: "Moving" }, { value: "final", label: "Finished" }], test: (r, v) => (v === "final" ? r.final : v === "stalled" ? !r.final && r.daysInStage > 14 : !r.final && r.daysInStage <= 14) },
    ],
    stats: (rs) => {
      const open = rs.filter((r) => !r.final);
      return [
        { label: "Applications", value: rs.length },
        { label: "Still open", value: open.length },
        { label: "Stalled over 14 days", value: open.filter((r) => r.daysInStage > 14).length },
        { label: "Median days, start to finish", value: median(rs.filter((r) => r.final).map((r) => r.daysTotal)) },
      ];
    },
  };
}

function median(ns: number[]) {
  if (!ns.length) return "—";
  const s = [...ns].sort((a, b) => a - b);
  return String(s[Math.floor(s.length / 2)]);
}

type Payment = Row<typeof src.paymentRows>;
const PAY_STATE: Record<Payment["state"], { label: string; tone: Tone }> = {
  AWAITING: FEE_APPROVAL_META.AWAITING,
  APPROVED: FEE_APPROVAL_META.APPROVED,
  REJECTED: FEE_APPROVAL_META.REJECTED,
};
function payments(rows: Payment[]): ReportDef<Payment> {
  return {
    key: "payments",
    title: "Payments",
    description: "Application fee and tuition payments, AOSA's decision on each and the bank code it issued.",
    noun: "payments",
    dateLabel: "Recorded",
    date: (r) => r.recordedAt,
    search: (r) => [r.student, r.reference, r.paymentRef, r.bankCode, r.institution],
    defaultSort: { key: "recorded", dir: "desc" },
    columns: [
      { key: "student", label: "Student", sort: (r) => r.student, text: (r) => r.student, render: (r) => (<><p className="text-[var(--color-ink)]">{r.student}</p><p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.reference}</p></>) },
      { key: "kind", label: "For", sort: (r) => r.kind, text: (r) => r.kind },
      { key: "institution", label: "Institution", sort: (r) => r.institution, text: (r) => r.institution, adminOnly: true },
      { key: "method", label: "Method", sort: (r) => r.method, text: (r) => r.method, adminOnly: true },
      { key: "ref", label: "Payment reference", sort: (r) => r.paymentRef, text: (r) => r.paymentRef, render: (r) => <span className="font-mono text-xs">{r.paymentRef}</span>, adminOnly: true },
      { key: "amount", label: "Amount", align: "right", sort: (r) => r.institutionAmount, text: (r) => String(r.institutionAmount), render: (r) => money(r.institutionAmount) },
      // The web fee exists only for AOSA. Institutions never get this column, on screen or in an export.
      { key: "web", label: "Web fee", align: "right", sort: (r) => r.webFee, text: (r) => String(r.webFee), render: (r) => (r.webFee ? money(r.webFee) : <span className="text-[var(--color-ink-faint)]">—</span>), adminOnly: true },
      { key: "total", label: "Total paid", align: "right", sort: (r) => r.total, text: (r) => String(r.total), render: (r) => money(r.total), adminOnly: true },
      { key: "state", label: "Status", sort: (r) => r.state, text: (r) => PAY_STATE[r.state].label, render: (r) => badge(PAY_STATE[r.state]) },
      { key: "bank", label: "Bank code", sort: (r) => r.bankCode, text: (r) => r.bankCode, render: (r) => (r.bankCode ? <span className="whitespace-nowrap font-mono text-xs">{r.bankCode}</span> : <span className="text-[var(--color-ink-faint)]">—</span>) },
      dateCol<Payment>("recorded", "Recorded", (r) => r.recordedAt),
      dateCol<Payment>("approved", "Approved", (r) => r.approvedAt),
    ],
    filters: [
      institutionFilter(rows),
      { key: "kind", label: "For", options: [{ value: "Application fee", label: "Application fee" }, { value: "Tuition", label: "Tuition" }], test: (r, v) => r.kind === v },
      { key: "state", label: "Status", options: opts(PAY_STATE), test: (r, v) => r.state === v },
      { key: "method", label: "Method", options: uniq(rows, (r) => r.method), test: (r, v) => r.method === v, adminOnly: true },
    ],
    stats: (rs, scope) => {
      const approved = rs.filter((r) => r.state === "APPROVED");
      return scope === "admin"
        ? [
            { label: "Payments", value: rs.length, detail: `${rs.filter((r) => r.state === "AWAITING").length} awaiting approval` },
            { label: "Approved total", value: money(approved.reduce((s, r) => s + r.total, 0)) },
            { label: "Web fees approved", value: money(approved.reduce((s, r) => s + r.webFee, 0)) },
            { label: "Rejected", value: rs.filter((r) => r.state === "REJECTED").length },
          ]
        : [
            { label: "Approved payments", value: approved.length },
            { label: "Application fees", value: money(approved.filter((r) => r.kind === "Application fee").reduce((s, r) => s + r.institutionAmount, 0)) },
            { label: "Tuition", value: money(approved.filter((r) => r.kind === "Tuition").reduce((s, r) => s + r.institutionAmount, 0)) },
            { label: "Bank codes issued", value: approved.filter((r) => r.bankCode).length },
          ];
    },
  };
}

type Ack = Row<typeof src.acknowledgedRows>;
function acknowledged(rows: Ack[]): ReportDef<Ack> {
  return {
    key: "acknowledged-applications",
    title: "Acknowledged applications",
    description: "Applications the institution confirmed receiving, and offers the applicant took up.",
    noun: "acknowledgements",
    dateLabel: "Acknowledged",
    date: (r) => r.at,
    search: (r) => [r.student, r.reference, r.program, r.institution],
    defaultSort: { key: "at", dir: "desc" },
    columns: [
      ...appColumns<Ack>(),
      { key: "by", label: "Acknowledged by", sort: (r) => r.by, text: (r) => r.by },
      dateCol<Ack>("at", "Acknowledged", (r) => r.at),
      { key: "days", label: "Days from submission", align: "right", sort: (r) => r.daysFromSubmission, text: (r) => String(r.daysFromSubmission) },
      { key: "status", label: "Current status", sort: (r) => r.status, text: (r) => ADMIN_STATUS_LABELS[r.status], render: (r) => <AdminStatusBadge status={r.status} /> },
    ],
    filters: [institutionFilter(rows), { key: "by", label: "Acknowledged by", options: [{ value: "I_ACKNOWLEDGED", label: "Institution" }, { value: "A_ACKNOWLEDGED", label: "Applicant (offer taken up)" }], test: (r, v) => r.byKey === v }],
    stats: (rs) => [
      { label: "Acknowledgements", value: rs.length },
      { label: "By institution", value: rs.filter((r) => r.byKey === "I_ACKNOWLEDGED").length },
      { label: "Offers taken up", value: rs.filter((r) => r.byKey === "A_ACKNOWLEDGED").length },
      { label: "Median days from submission", value: median(rs.filter((r) => r.byKey === "I_ACKNOWLEDGED").map((r) => r.daysFromSubmission)) },
    ],
  };
}

type Rejected = Row<typeof src.rejectedRows>;
function rejected(rows: Rejected[]): ReportDef<Rejected> {
  return {
    key: "rejected-applications",
    title: "Rejected applications",
    description: "Applications the institution rejected, and offers the applicant declined, with the reason given.",
    noun: "rejections",
    dateLabel: "Rejected",
    date: (r) => r.at,
    search: (r) => [r.student, r.reference, r.program, r.institution, r.reason],
    defaultSort: { key: "at", dir: "desc" },
    columns: [
      ...appColumns<Rejected>(),
      { key: "by", label: "Rejected by", sort: (r) => r.by, text: (r) => r.by },
      { key: "reason", label: "Reason", sort: (r) => r.reason, text: (r) => r.reason, render: (r) => <span className="block max-w-[18rem] text-[var(--color-ink-soft)]">{r.reason}</span> },
      dateCol<Rejected>("at", "Rejected", (r) => r.at),
    ],
    filters: [
      institutionFilter(rows),
      { key: "by", label: "Rejected by", options: [{ value: "I_REJECTED", label: "Institution" }, { value: "A_REJECTED", label: "Applicant (declined offer)" }], test: (r, v) => r.byKey === v },
      { key: "reason", label: "Reason", options: uniq(rows, (r) => r.reason), test: (r, v) => r.reason === v },
    ],
    stats: (rs) => {
      const byInst = rs.filter((r) => r.byKey === "I_REJECTED");
      const top = [...byInst.reduce((m, r) => m.set(r.reason, (m.get(r.reason) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0];
      return [
        { label: "Rejections", value: rs.length },
        { label: "By institution", value: byInst.length },
        { label: "Offers declined", value: rs.length - byInst.length },
        { label: "Most common reason", value: top ? top[1] : "—", detail: top?.[0] },
      ];
    },
  };
}

type Delib = Row<typeof src.deliberationRows>;
const OUTCOME: Record<string, { label: string; tone: Tone }> = {
  ADMITTED: { label: "Admitted", tone: "success" },
  NOT_ADMITTED: { label: "Not admitted", tone: "danger" },
  PENDING: { label: "Awaiting deliberation", tone: "info" },
};
function deliberation(rows: Delib[]): ReportDef<Delib> {
  return {
    key: "deliberation",
    title: "Deliberation",
    description: "Acknowledged applications put through deliberation: the rule applied, the score and the outcome.",
    noun: "applications",
    dateLabel: "Deliberated",
    date: (r) => r.session ?? r.acknowledgedAt,
    search: (r) => [r.student, r.reference, r.program, r.institution, r.rule],
    defaultSort: { key: "session", dir: "desc" },
    columns: [
      ...appColumns<Delib>(),
      { key: "rule", label: "Rule", sort: (r) => r.rule, text: (r) => r.rule },
      dateCol<Delib>("session", "Session", (r) => r.session),
      { key: "score", label: "Score", align: "right", sort: (r) => r.score, text: (r) => (r.score === null ? "" : String(r.score)) },
      { key: "choice", label: "Choice", align: "right", sort: (r) => r.choice, text: (r) => String(r.choice) },
      { key: "outcome", label: "Outcome", sort: (r) => r.outcome, text: (r) => OUTCOME[r.outcome].label, render: (r) => badge(OUTCOME[r.outcome]) },
    ],
    filters: [institutionFilter(rows), { key: "outcome", label: "Outcome", options: opts(OUTCOME), test: (r, v) => r.outcome === v }, { key: "rule", label: "Rule", options: uniq(rows, (r) => r.rule), test: (r, v) => r.rule === v }],
    stats: (rs) => {
      const done = rs.filter((r) => r.outcome !== "PENDING");
      const admitted = done.filter((r) => r.outcome === "ADMITTED");
      return [
        { label: "Deliberated", value: done.length, detail: `${rs.length - done.length} awaiting` },
        { label: "Admitted", value: admitted.length, detail: pct(admitted.length, done.length) },
        { label: "Average admitted score", value: admitted.length ? Math.round(admitted.reduce((s, r) => s + (r.score ?? 0), 0) / admitted.length) : "—" },
        { label: "Admitted on first choice", value: pct(admitted.filter((r) => r.choice === 1).length, admitted.length) },
      ];
    },
  };
}

type Admission = Row<typeof src.admissionRows>;
const RESPONSE: Record<string, { label: string; tone: Tone }> = {
  TAKEN_UP: { label: "Offer taken up", tone: "success" },
  DECLINED: { label: "Offer declined", tone: "danger" },
  AWAITING: { label: "Awaiting reply", tone: "amber" },
};
function admission(rows: Admission[]): ReportDef<Admission> {
  return {
    key: "admission",
    title: "Admission",
    description: "Offers of admission and how applicants responded.",
    noun: "offers",
    dateLabel: "Offered",
    date: (r) => r.offeredAt,
    search: (r) => [r.student, r.reference, r.program, r.institution],
    defaultSort: { key: "offered", dir: "desc" },
    columns: [
      ...appColumns<Admission>(),
      dateCol<Admission>("offered", "Offered", (r) => r.offeredAt),
      { key: "response", label: "Response", sort: (r) => r.response, text: (r) => RESPONSE[r.response].label, render: (r) => badge(RESPONSE[r.response]) },
      dateCol<Admission>("responded", "Responded", (r) => r.respondedAt),
      { key: "days", label: "Days to respond", align: "right", sort: (r) => r.daysToRespond, text: (r) => String(r.daysToRespond), render: (r) => (r.response === "AWAITING" ? <span className="text-[var(--color-warning-strong)]">{r.daysToRespond} so far</span> : r.daysToRespond) },
    ],
    filters: [institutionFilter(rows), { key: "response", label: "Response", options: opts(RESPONSE), test: (r, v) => r.response === v }],
    stats: (rs) => {
      const replied = rs.filter((r) => r.response !== "AWAITING");
      return [
        { label: "Offers", value: rs.length },
        { label: "Taken up", value: rs.filter((r) => r.response === "TAKEN_UP").length, detail: `${pct(rs.filter((r) => r.response === "TAKEN_UP").length, replied.length)} of replies` },
        { label: "Declined", value: rs.filter((r) => r.response === "DECLINED").length },
        { label: "Awaiting reply", value: rs.length - replied.length },
      ];
    },
  };
}

type Tuition = Row<typeof src.tuitionRows>;
function tuition(rows: Tuition[]): ReportDef<Tuition> {
  return {
    key: "tuition",
    title: "Tuition",
    description: "Tuition for admitted students: what's owed, what AOSA has verified and what's outstanding.",
    noun: "admitted students",
    dateLabel: "Admitted",
    date: (r) => r.admittedAt,
    search: (r) => [r.student, r.registrationNo, r.program, r.institution],
    defaultSort: { key: "outstanding", dir: "desc" },
    columns: [
      { key: "student", label: "Student", sort: (r) => r.student, text: (r) => r.student, render: (r) => (<><p className="text-[var(--color-ink)]">{r.student}</p><p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.registrationNo}</p></>) },
      { key: "program", label: "Program", sort: (r) => r.program, text: (r) => r.program },
      { key: "institution", label: "Institution", sort: (r) => r.institution, text: (r) => r.institution, adminOnly: true },
      { key: "category", label: "Fee category", sort: (r) => r.category, text: (r) => r.category, adminOnly: true },
      { key: "tuition", label: "Tuition", align: "right", sort: (r) => r.tuition, text: (r) => String(r.tuition), render: (r) => money(r.tuition) },
      { key: "verified", label: "Verified", align: "right", sort: (r) => r.verified, text: (r) => String(r.verified), render: (r) => money(r.verified) },
      { key: "awaiting", label: "Awaiting AOSA", align: "right", sort: (r) => r.awaiting, text: (r) => String(r.awaiting), render: (r) => money(r.awaiting), adminOnly: true },
      { key: "outstanding", label: "Outstanding", align: "right", sort: (r) => r.outstanding, text: (r) => String(r.outstanding), render: (r) => money(r.outstanding) },
      { key: "pay", label: "Payment status", sort: (r) => r.paymentStatus, text: (r) => PAYMENT_STATUS_META[r.paymentStatus].label, render: (r) => badge(PAYMENT_STATUS_META[r.paymentStatus]), adminOnly: true },
      { key: "verif", label: "Verification", sort: (r) => r.verificationStatus, text: (r) => VERIFICATION_META[r.verificationStatus].label, render: (r) => badge(VERIFICATION_META[r.verificationStatus]), adminOnly: true },
      { key: "istate", label: "Status", sort: (r) => r.institutionState, text: (r) => INSTITUTION_TUITION_META[r.institutionState].label, render: (r) => badge(INSTITUTION_TUITION_META[r.institutionState]), institutionOnly: true },
      { key: "reconcile", label: "To mark received", align: "right", sort: (r) => r.toReconcile, text: (r) => String(r.toReconcile), institutionOnly: true },
    ],
    filters: [
      institutionFilter(rows),
      { key: "verif", label: "Verification", options: opts(VERIFICATION_META), test: (r, v) => r.verificationStatus === v, adminOnly: true },
      { key: "pay", label: "Payment status", options: opts(PAYMENT_STATUS_META), test: (r, v) => r.paymentStatus === v, adminOnly: true },
      { key: "istate", label: "Status", options: opts(INSTITUTION_TUITION_META).filter((o) => o.value !== "AWAITING"), test: (r, v) => r.institutionState === v },
    ],
    stats: (rs) => [
      { label: "Tuition due", value: money(rs.reduce((s, r) => s + r.tuition, 0)) },
      { label: "Verified", value: money(rs.reduce((s, r) => s + r.verified, 0)) },
      { label: "Outstanding", value: money(rs.reduce((s, r) => s + r.outstanding, 0)) },
      { label: "Paid in full", value: rs.filter((r) => r.verified >= r.tuition).length, detail: `of ${rs.length} students` },
    ],
  };
}

type Medical = Row<typeof src.medicalRows>;
function medical(rows: Medical[]): ReportDef<Medical> {
  return {
    key: "medical-verification",
    title: "Medical verification",
    description: "Each admitted student's medical requirements, their verification and the result.",
    noun: "medical requirements",
    dateLabel: "Verified",
    date: (r) => r.verificationDate,
    search: (r) => [r.studentName, r.registrationNo, r.certificateRef, r.institution, r.programName],
    defaultSort: { key: "date", dir: "desc" },
    columns: [
      { key: "student", label: "Student", sort: (r) => r.studentName, text: (r) => r.studentName, render: (r) => (<><p className="text-[var(--color-ink)]">{r.studentName}</p><p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.registrationNo}</p></>) },
      { key: "institution", label: "Institution", sort: (r) => r.institution, text: (r) => r.institution, adminOnly: true },
      { key: "req", label: "Medical requirement", sort: (r) => requirementLabel(r.requirementCode), text: (r) => requirementLabel(r.requirementCode) },
      { key: "status", label: "Verification status", sort: (r) => r.status, text: (r) => MEDICAL_STATUS_META[r.status].label, render: (r) => badge(MEDICAL_STATUS_META[r.status]) },
      dateCol<Medical>("date", "Verification date", (r) => r.verificationDate),
      { key: "result", label: "Result", sort: (r) => r.result ?? "", text: (r) => (r.result ? MEDICAL_RESULT_META[r.result].label : ""), render: (r) => (r.result ? badge(MEDICAL_RESULT_META[r.result]) : <span className="text-[var(--color-ink-faint)]">—</span>) },
      { key: "centre", label: "Centre", sort: (r) => r.centre ?? "", text: (r) => r.centre ?? "" },
    ],
    filters: [
      institutionFilter(rows),
      { key: "req", label: "Requirement", options: MEDICAL_REQUIREMENTS.map((m) => ({ value: m.code, label: m.label })), test: (r, v) => r.requirementCode === v },
      { key: "status", label: "Verification status", options: opts(MEDICAL_STATUS_META), test: (r, v) => r.status === v },
      { key: "result", label: "Result", options: opts(MEDICAL_RESULT_META), test: (r, v) => r.result === v },
    ],
    stats: (rs) => [
      { label: "Requirements", value: rs.length },
      { label: "Verified", value: rs.filter((r) => r.status === "VERIFIED").length, detail: pct(rs.filter((r) => r.status === "VERIFIED").length, rs.length) },
      { label: "Awaiting verification", value: rs.filter((r) => r.status === "AWAITING").length },
      { label: "Unfit or retest", value: rs.filter((r) => r.result === "UNFIT" || r.status === "RETEST").length },
    ],
  };
}

type Matric = Row<typeof src.matriculationRows>;
function matriculation(rows: Matric[]): ReportDef<Matric> {
  return {
    key: "matriculation",
    title: "Matriculation",
    description: "Admitted students against the three matriculation conditions, and the codes issued.",
    noun: "admitted students",
    dateLabel: "Matriculated",
    date: (r) => r.matriculatedAt,
    search: (r) => [r.student, r.registrationNo, r.program, r.institution, r.code],
    defaultSort: { key: "status", dir: "asc" },
    columns: [
      { key: "student", label: "Student", sort: (r) => r.student, text: (r) => r.student, render: (r) => (<><p className="text-[var(--color-ink)]">{r.student}</p><p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.registrationNo}</p></>) },
      { key: "institution", label: "Institution", sort: (r) => r.institution, text: (r) => r.institution, adminOnly: true },
      { key: "program", label: "Program", sort: (r) => r.program, text: (r) => r.program },
      { key: "admission", label: "Admission status", sort: (r) => r.admission, text: (r) => ADMISSION_META[r.admission].label, render: (r) => badge(ADMISSION_META[r.admission]) },
      { key: "tuition", label: "Tuition status", sort: (r) => r.tuition, text: (r) => TUITION_CLEARANCE_META[r.tuition].label, render: (r) => badge(TUITION_CLEARANCE_META[r.tuition]) },
      { key: "medical", label: "Medical status", sort: (r) => r.medical, text: (r) => CLEARANCE_META[r.medical].label, render: (r) => badge(CLEARANCE_META[r.medical]) },
      { key: "status", label: "Matriculation status", sort: (r) => ({ READY: 0, NOT_READY: 1, MATRICULATED: 2 })[r.status], text: (r) => MATRIC_STATUS_META[r.status].label, render: (r) => badge(MATRIC_STATUS_META[r.status]) },
      { key: "code", label: "Matriculation code", sort: (r) => r.code, text: (r) => r.code, render: (r) => (r.code ? <span className="whitespace-nowrap font-mono text-xs">{r.code}</span> : <span className="text-[var(--color-ink-faint)]">—</span>) },
      dateCol<Matric>("at", "Matriculated", (r) => r.matriculatedAt),
    ],
    filters: [
      institutionFilter(rows),
      { key: "status", label: "Matriculation status", options: opts(MATRIC_STATUS_META), test: (r, v) => r.status === v },
      { key: "tuition", label: "Tuition status", options: opts(TUITION_CLEARANCE_META), test: (r, v) => r.tuition === v },
      { key: "medical", label: "Medical status", options: opts(CLEARANCE_META), test: (r, v) => r.medical === v },
    ],
    stats: (rs) => [
      { label: "Admitted students", value: rs.length },
      { label: "Matriculated", value: rs.filter((r) => r.status === "MATRICULATED").length, detail: pct(rs.filter((r) => r.status === "MATRICULATED").length, rs.length) },
      { label: "Ready to matriculate", value: rs.filter((r) => r.status === "READY").length },
      { label: "Requirements outstanding", value: rs.filter((r) => r.status === "NOT_READY").length },
    ],
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReport = { def: ReportDef<any>; rows: any[] };

export { REPORT_KEYS, isReportKey, reportsFor, type ReportKey } from "./keys";
import { type ReportKey } from "./keys";

export function buildReport(key: ReportKey, s: src.Sources, institutionId?: string): AnyReport {
  const make = <R extends { id: string; masked: boolean; maskedName: string }>(rows: R[], def: (rows: R[]) => ReportDef<R>): AnyReport => ({ rows, def: def(rows) });
  switch (key) {
    case "student-registration":
      return make(src.registrationRows(s), registration);
    case "applications":
      return make(src.applicationRows(s, institutionId), applications);
    case "application-progression":
      return make(src.progressionRows(s, institutionId), progression);
    case "payments":
      return make(src.paymentRows(s, institutionId), payments);
    case "acknowledged-applications":
      return make(src.acknowledgedRows(s, institutionId), acknowledged);
    case "rejected-applications":
      return make(src.rejectedRows(s, institutionId), rejected);
    case "deliberation":
      return make(src.deliberationRows(s, institutionId), deliberation);
    case "admission":
      return make(src.admissionRows(s, institutionId), admission);
    case "tuition":
      return make(src.tuitionRows(s, institutionId), tuition);
    case "medical-verification":
      return make(src.medicalRows(s, institutionId), medical);
    case "matriculation":
      return make(src.matriculationRows(s, institutionId), matriculation);
  }
}
