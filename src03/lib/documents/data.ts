import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { seededRandom } from "@/lib/admin/store";
import { figures, institutionTuitionView, RECORD_STATUS_META, type TuitionAccount } from "@/lib/tuition/data";
import { MEDICAL_RESULT_META, MEDICAL_STATUS_META, requirementLabel, type MedicalRecord } from "@/lib/medical/data";
import { type MatriculationRecord } from "@/lib/matriculation/data";
import { type FeePayment } from "@/lib/payments/applicationFees";

/**
 * Printable documents, built from mock data.
 *
 * Each document is a plain data model (DocModel) that one renderer draws
 * on screen, for printing and as a downloadable file. PDF generation
 * belongs to the backend phase: when it lands, the Download button calls
 * the API instead of saving the HTML copy, and nothing else here changes.
 */

export type { DocType } from "./types";
import type { DocType } from "./types";

export type Audience = "student" | "institution" | "admin";

export const DOC_TYPES: { type: DocType; label: string; description: string }[] = [
  { type: "application-summary", label: "Application summary", description: "One page: the program applied for, status and key dates." },
  { type: "completed-application", label: "Completed application", description: "Everything the student submitted: personal details, education, results and documents." },
  { type: "submission-confirmation", label: "Submission confirmation", description: "Proof the application reached the institution, with its reference." },
  { type: "payment-record", label: "Payment record", description: "Application fee and tuition payments with their verification and bank codes." },
  { type: "admission-letter", label: "Admission letter", description: "The institution's offer of admission." },
  { type: "matriculation-record", label: "Matriculation record", description: "Confirmation of enrolment with the matriculation code." },
];

export const docLabel = (t: DocType) => DOC_TYPES.find((d) => d.type === t)?.label ?? t;
export { isDocType } from "./types";

export type DocBlock =
  | { kind: "fields"; title?: string; fields: { label: string; value: string }[] }
  | { kind: "table"; title?: string; columns: string[]; rows: string[][]; numeric?: number[]; foot?: string[]; empty?: string }
  | { kind: "text"; title?: string; paragraphs: string[] }
  | { kind: "code"; label: string; value: string; caption?: string }
  | { kind: "signatures"; lines: { name: string; role: string }[] };

export interface DocModel {
  type: DocType;
  title: string;
  number: string;
  issuedAt: string;
  issuer: { name: string; lines: string[] };
  recipient?: { name: string; lines: string[] };
  blocks: DocBlock[];
  footnote: string;
}

// ---------------------------------------------------------------------------
// Context: everything a document may draw on, assembled by the caller
// ---------------------------------------------------------------------------

export interface DocContext {
  account: TuitionAccount;
  student: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    email: string;
    phone: string;
    address: string;
    town: string;
    region: string;
    qualification: string;
  };
  institution: { name: string; address: string; town: string; phone: string; domain: string; contact: string };
  application: { reference: string; createdAt: string; submittedAt: string; choices: string[] };
  fee: FeePayment | undefined;
  methodLabel: (methodId: string) => string;
  medical: MedicalRecord[];
  matric: MatriculationRecord | null;
}

export interface Availability {
  available: boolean;
  reason?: string;
}

export function availability(type: DocType, ctx: DocContext, audience: Audience): Availability {
  if (type === "matriculation-record" && !ctx.matric) return { available: false, reason: "Issued once the student is matriculated." };
  if (type === "payment-record" && audience === "institution") {
    const view = institutionTuitionView(ctx.account);
    const feeApproved = ctx.fee?.approval === "APPROVED";
    if (view.masked || (!feeApproved && view.confirmedPayments.length === 0)) return { available: false, reason: "Available once AOSA approves a payment." };
  }
  return { available: true };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const PREVIEW_NOTE = "Preview generated from mock data. The official PDF, with a verification seal, is issued once the document service is connected.";

function docNumber(type: DocType, ctx: DocContext) {
  const abbr: Record<DocType, string> = {
    "application-summary": "AS",
    "completed-application": "CA",
    "submission-confirmation": "SC",
    "payment-record": "PR",
    "admission-letter": "AL",
    "matriculation-record": "MR",
  };
  return `AOSA-${abbr[type]}-${ctx.application.reference.replace(/[^A-Z0-9]/gi, "").slice(-7).toUpperCase()}`;
}

const fullName = (ctx: DocContext) => `${ctx.student.firstName} ${ctx.student.lastName}`;

function issuerAOSA() {
  return { name: "Cheeta AOSA", lines: ["Admission and Orientation Services", "Yaoundé, Cameroon"] };
}
function issuerInstitution(ctx: DocContext) {
  return { name: ctx.institution.name, lines: [ctx.institution.address, ctx.institution.town, ctx.institution.phone].filter(Boolean) };
}

function studentFields(ctx: DocContext) {
  return [
    { label: "Name", value: fullName(ctx) },
    { label: "Registration no.", value: ctx.account.registrationNo },
    { label: "Date of birth", value: formatDate(ctx.student.dateOfBirth) },
    { label: "Gender", value: ctx.student.gender },
    { label: "Email", value: ctx.student.email },
    { label: "Phone", value: ctx.student.phone },
    { label: "Address", value: [ctx.student.address, ctx.student.town, ctx.student.region].filter(Boolean).join(", ") },
  ];
}

/** Stable mock grades so a reprint shows the same results. */
function mockResults(ctx: DocContext): string[][] {
  const rnd = seededRandom([...ctx.account.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
  const gce = ctx.student.qualification.startsWith("GCE");
  const subjects = gce ? ["Mathematics", "Physics", "Chemistry", "Biology", "English Language"] : ["Mathématiques", "Physique-Chimie", "SVT", "Français", "Philosophie"];
  const grades = gce ? ["A", "B", "B", "C", "C", "D"] : ["16", "14", "13", "12", "11", "10"];
  return subjects.map((s) => [s, grades[Math.floor(rnd() * grades.length)]]);
}

export function buildDocument(type: DocType, ctx: DocContext, audience: Audience): DocModel {
  const a = ctx.account;
  const number = docNumber(type, ctx);
  const program = a.programName;
  const firstChoice = ctx.application.choices[0] ?? program;

  switch (type) {
    case "application-summary":
      return {
        type,
        title: "Application summary",
        number,
        issuedAt: new Date().toISOString(),
        issuer: issuerAOSA(),
        blocks: [
          {
            kind: "fields",
            fields: [
              { label: "Applicant", value: fullName(ctx) },
              { label: "Registration no.", value: a.registrationNo },
              { label: "Application", value: ctx.application.reference },
              { label: "Institution", value: ctx.institution.name },
              { label: "Program (first choice)", value: firstChoice },
              { label: "Started", value: formatDate(ctx.application.createdAt) },
              { label: "Submitted", value: formatDate(ctx.application.submittedAt) },
              { label: "Status", value: a.offerAccepted ? "Admitted, offer accepted" : "Admitted, awaiting reply" },
            ],
          },
          { kind: "table", title: "Program choices", columns: ["Choice", "Program"], rows: ctx.application.choices.map((c, i) => [String(i + 1), c]) },
        ],
        footnote: PREVIEW_NOTE,
      };

    case "completed-application":
      return {
        type,
        title: "Completed application",
        number,
        issuedAt: new Date().toISOString(),
        issuer: issuerAOSA(),
        blocks: [
          { kind: "fields", title: "Personal details", fields: studentFields(ctx) },
          { kind: "fields", title: "Education", fields: [{ label: "Highest qualification", value: ctx.student.qualification }, { label: "Session", value: String(new Date(ctx.application.createdAt).getUTCFullYear() - 1) }] },
          { kind: "table", title: "Examination results", columns: ["Subject", ctx.student.qualification.startsWith("GCE") ? "Grade" : "Mark / 20"], rows: mockResults(ctx), numeric: [1] },
          { kind: "table", title: "Program choices", columns: ["Choice", "Institution", "Program"], rows: ctx.application.choices.map((c, i) => [String(i + 1), ctx.institution.name, c]) },
          {
            kind: "table",
            title: "Documents supplied",
            columns: ["Document", "State"],
            rows: [["Birth certificate", "Verified"], ["National ID card", "Verified"], ["Results slip", "Verified"], ["Passport photograph", "Verified"]],
          },
          { kind: "text", title: "Declaration", paragraphs: [`I, ${fullName(ctx)}, declare that the information in this application is true and complete. I understand that false information may lead to the offer being withdrawn.`] },
          { kind: "signatures", lines: [{ name: fullName(ctx), role: `Applicant, submitted ${formatDate(ctx.application.submittedAt)}` }] },
        ],
        footnote: PREVIEW_NOTE,
      };

    case "submission-confirmation":
      return {
        type,
        title: "Submission confirmation",
        number,
        issuedAt: ctx.application.submittedAt,
        issuer: issuerAOSA(),
        recipient: { name: fullName(ctx), lines: [ctx.student.email, ctx.student.phone] },
        blocks: [
          { kind: "text", paragraphs: [`Your application to ${ctx.institution.name} was received on ${formatDateTime(ctx.application.submittedAt)}. Quote the reference below in any correspondence.`] },
          { kind: "code", label: "Application reference", value: ctx.application.reference },
          {
            kind: "fields",
            fields: [
              { label: "Institution", value: ctx.institution.name },
              { label: "Program (first choice)", value: firstChoice },
              { label: "Submitted", value: formatDateTime(ctx.application.submittedAt) },
            ],
          },
          { kind: "text", paragraphs: ["The institution reviews your file once AOSA has confirmed your application fee. You will be notified at each stage."] },
        ],
        footnote: PREVIEW_NOTE,
      };

    case "payment-record":
      return paymentRecord(ctx, audience, number);

    case "admission-letter":
      return {
        type,
        title: "Offer of admission",
        number,
        issuedAt: a.admittedAt,
        issuer: issuerInstitution(ctx),
        recipient: { name: fullName(ctx), lines: [ctx.student.address, ctx.student.town, ctx.student.region].filter(Boolean) },
        blocks: [
          {
            kind: "text",
            paragraphs: [
              `Dear ${ctx.student.firstName},`,
              `We are pleased to offer you admission to ${program} at ${ctx.institution.name} for the 2026/2027 academic year.`,
              `To take up this offer, accept it from your applicant dashboard, pay at least the first tuition instalment and complete your medical verification. You will then be matriculated and given your matriculation code.`,
            ],
          },
          {
            kind: "fields",
            fields: [
              { label: "Program", value: program },
              { label: "Application", value: ctx.application.reference },
              { label: "Registration no.", value: a.registrationNo },
              { label: "Tuition", value: formatCurrency(a.tuitionAmount) },
              { label: "First instalment due", value: a.instalments[0] ? `${formatCurrency(a.instalments[0].amount)} by ${formatDate(a.instalments[0].dueDate)}` : "—" },
            ],
          },
          { kind: "signatures", lines: [{ name: ctx.institution.contact || "Admissions Office", role: `For ${ctx.institution.name}` }] },
        ],
        footnote: PREVIEW_NOTE,
      };

    case "matriculation-record": {
      const m = ctx.matric;
      return {
        type,
        title: "Matriculation record",
        number,
        issuedAt: m?.matriculatedAt ?? new Date().toISOString(),
        issuer: issuerInstitution(ctx),
        blocks: [
          { kind: "code", label: "Matriculation code", value: m?.code ?? "Not issued", caption: `Use this code on all correspondence with ${ctx.institution.name}.` },
          {
            kind: "fields",
            fields: [
              { label: "Student", value: fullName(ctx) },
              { label: "Registration no.", value: a.registrationNo },
              { label: "Program", value: program },
              { label: "Academic year", value: "2026/2027" },
              { label: "Matriculated", value: m ? formatDate(m.matriculatedAt) : "—" },
              { label: "Confirmed by", value: m?.confirmedBy ?? "—" },
            ],
          },
          {
            kind: "table",
            title: "Requirements met",
            columns: ["Requirement", "Outcome"],
            rows: [
              ["Admission", a.offerAccepted ? "Offer accepted" : "Awaiting reply"],
              ["Tuition", `${formatCurrency(figures(a).verified)} verified by AOSA`],
              ...ctx.medical.map((r) => [requirementLabel(r.requirementCode), r.result ? MEDICAL_RESULT_META[r.result].label : MEDICAL_STATUS_META[r.status].label]),
            ],
          },
          { kind: "signatures", lines: [{ name: m?.confirmedBy ?? "Registrar", role: `Registrar, ${ctx.institution.name}` }] },
        ],
        footnote: PREVIEW_NOTE,
      };
    }
  }
}

function paymentRecord(ctx: DocContext, audience: Audience, number: string): DocModel {
  const a = ctx.account;
  const blocks: DocBlock[] = [
    {
      kind: "fields",
      fields: [
        { label: "Student", value: `${ctx.student.firstName} ${ctx.student.lastName}` },
        { label: "Registration no.", value: a.registrationNo },
        { label: "Institution", value: ctx.institution.name },
        { label: "Program", value: a.programName },
      ],
    },
  ];

  const fee = ctx.fee;
  if (audience === "institution") {
    // Only approved payments, by bank code, and never the web fee.
    const feeRows = fee?.approval === "APPROVED" && fee.bankCode ? [[fee.bankCode, "Application fee", formatDate(fee.reviewedAt), formatCurrency(fee.applicationFee)]] : [];
    const view = institutionTuitionView(a);
    const tuitionRows = view.confirmedPayments.map((p) => [p.bankCode, "Tuition", formatDate(p.verifiedAt), formatCurrency(p.amount)]);
    blocks.push({
      kind: "table",
      title: "Payments approved by AOSA",
      columns: ["Bank code", "For", "Approved", "Amount"],
      rows: [...feeRows, ...tuitionRows],
      numeric: [3],
      empty: "No approved payments.",
    });
    if (view.tuition !== null) {
      blocks.push({ kind: "fields", title: "Tuition", fields: [{ label: "Tuition", value: formatCurrency(view.tuition) }, { label: "Approved", value: formatCurrency(view.confirmed ?? 0) }, { label: "Outstanding", value: formatCurrency(view.outstanding ?? 0) }] });
    }
    if (view.awaitingCount > 0) blocks.push({ kind: "text", paragraphs: [`${view.awaitingCount} further ${view.awaitingCount === 1 ? "payment is" : "payments are"} awaiting AOSA approval and not shown.`] });
  } else {
    if (fee) {
      blocks.push({
        kind: "table",
        title: "Application fee",
        columns: ["Item", "Amount"],
        rows: [["Application fee", formatCurrency(fee.applicationFee)], ["Web fee", formatCurrency(fee.webFee)]],
        numeric: [1],
        foot: ["Total paid", formatCurrency(fee.amount)],
      });
      blocks.push({
        kind: "fields",
        fields: [
          { label: "Method", value: fee.method },
          { label: "Reference", value: fee.reference },
          { label: "Paid", value: formatDate(fee.paidAt) },
          { label: "AOSA approval", value: fee.approval === "APPROVED" ? `Approved ${formatDate(fee.reviewedAt)}` : fee.approval === "REJECTED" ? "Rejected" : "Awaiting approval" },
          { label: "Bank code", value: fee.bankCode ?? "Issued on approval" },
        ],
      });
    }
    const f = figures(a);
    blocks.push({
      kind: "table",
      title: "Tuition payments",
      columns: ["Paid", "Method", "Reference", "Status", "Bank code", "Amount"],
      rows: [...a.payments]
        .sort((x, y) => x.paidOn.localeCompare(y.paidOn))
        .map((p) => [formatDate(p.paidOn), ctx.methodLabel(p.methodId), p.reference, RECORD_STATUS_META[p.status].label, p.bankCode ?? "—", formatCurrency(p.amount)]),
      numeric: [5],
      empty: "No tuition payments recorded.",
      foot: ["Verified", "", "", "", "", formatCurrency(f.verified)],
    });
    blocks.push({ kind: "fields", fields: [{ label: "Tuition", value: formatCurrency(f.tuition) }, { label: "Outstanding", value: formatCurrency(f.outstanding) }] });
  }

  return {
    type: "payment-record",
    title: "Payment record",
    number,
    issuedAt: new Date().toISOString(),
    issuer: issuerAOSA(),
    blocks,
    footnote: "No money is processed on the Cheeta AOSA platform. This record lists payments made outside it and their verification. " + PREVIEW_NOTE,
  };
}
