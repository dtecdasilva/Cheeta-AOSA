import { createCollection, mockAnchor, seededRandom } from "@/lib/admin/store";
import { seedAdminRecords } from "@/lib/admin/students";
import { maskName, makeBankCode, seedBankCode } from "./privacy";

/**
 * Application fee payments and their approval by AOSA.
 *
 * A student pays the application fee plus the platform's web fee outside
 * the platform, then records it. AOSA administration checks the payment
 * and approves or rejects it. Approval issues a bank code.
 *
 * The institution never reviews these. It sees "<first name> <initial>.
 * — awaiting payment" until AOSA approves, and then only its own
 * application fee (never the web fee), identified by the bank code.
 * See ./privacy.ts.
 *
 * No money moves on the platform. Nothing here processes a payment.
 */

export type FeeApproval = "AWAITING" | "APPROVED" | "REJECTED";

export interface FeePayment {
  id: string;
  applicationId: string;
  applicationRef: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  institutionId: string;
  programName: string;
  method: string;
  reference: string;
  receiptFile: string | null;
  applicationFee: number;
  /** Platform fee. Admin and student only; never shown to institutions. */
  webFee: number;
  amount: number;
  paidAt: string;
  submittedAt: string;
  approval: FeeApproval;
  bankCode: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  note: string;
}

export const FEE_APPROVAL_META: Record<FeeApproval, { label: string; tone: "info" | "success" | "danger" }> = {
  AWAITING: { label: "Awaiting approval", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const AOSA_PAYMENTS_DESK = "AOSA payments desk";

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

function seedFees(): FeePayment[] {
  const rnd = seededRandom(4412);
  const anchor = mockAnchor().getTime();
  const { students, applications } = seedAdminRecords();
  const byId = new Map(students.map((s) => [s.id, s]));
  const out: FeePayment[] = [];

  for (const app of applications) {
    const p = app.payment;
    const s = byId.get(app.studentId);
    if (!p || !s) continue;
    const paidAt = p.paidAt ?? p.initiatedAt;
    const submittedAt = new Date(new Date(paidAt).getTime() + Math.floor(rnd() * 5) * 3_600_000).toISOString();
    const ageDays = (anchor - new Date(paidAt).getTime()) / DAY;

    // PAID payments older than a few days have been through the desk.
    // Recent ones, and "PENDING" ones, are in the queue. "FAILED" were
    // rejected because the money never arrived.
    let approval: FeeApproval;
    if (p.status === "FAILED") approval = "REJECTED";
    else if (p.status === "PENDING" || ageDays < 4) approval = "AWAITING";
    else approval = "APPROVED";

    const reviewedAt = approval === "AWAITING" ? null : new Date(Math.min(new Date(submittedAt).getTime() + (0.5 + rnd() * 2) * DAY, anchor - 3_600_000)).toISOString();
    out.push({
      id: `fee-${app.id}`,
      applicationId: app.id,
      applicationRef: app.reference,
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      institutionId: app.institutionId,
      programName: app.programName,
      method: p.method,
      reference: p.reference,
      receiptFile: rnd() < 0.85 ? `receipt-${app.reference.toLowerCase()}.pdf` : null,
      applicationFee: p.applicationFee,
      webFee: p.webFee,
      amount: p.amount,
      paidAt,
      submittedAt,
      approval,
      bankCode: approval === "APPROVED" ? seedBankCode("A", new Date(reviewedAt!).getUTCFullYear(), app.id) : null,
      reviewedAt,
      reviewedBy: approval === "AWAITING" ? null : AOSA_PAYMENTS_DESK,
      note: approval === "REJECTED" ? "No credit with this reference on the collection account." : "",
    });
  }

  // The institution portal's own demo applications (lib/mockData), so the
  // portal's applications table and this store agree.
  const iso = (t: number) => new Date(t).toISOString();
  out.push(
    {
      id: "fee-app-1001",
      applicationId: "app-1001",
      applicationRef: "app-1001",
      studentId: "portal-app-1001",
      firstName: "Aïssatou",
      lastName: "Mballa",
      email: "aissatou.m@example.com",
      institutionId: "inst-1",
      programName: "BSc Biology",
      method: "Mobile money",
      reference: "PAY-0001",
      receiptFile: "momo-receipt-0001.jpg",
      applicationFee: 15000,
      webFee: 2500,
      amount: 17500,
      paidAt: iso(anchor - 2 * DAY + 9 * 3_600_000),
      submittedAt: iso(anchor - 2 * DAY + 10 * 3_600_000),
      approval: "AWAITING",
      bankCode: null,
      reviewedAt: null,
      reviewedBy: null,
      note: "",
    },
    {
      id: "fee-app-1003",
      applicationId: "app-1003",
      applicationRef: "app-1003",
      studentId: "portal-app-1003",
      firstName: "Chantal",
      lastName: "Fouda",
      email: "chantal.f@example.com",
      institutionId: "inst-1",
      programName: "BSc Biology",
      method: "Bank deposit",
      reference: "AFB-40119827",
      receiptFile: "afriland-slip-40119827.pdf",
      applicationFee: 15000,
      webFee: 2500,
      amount: 17500,
      paidAt: iso(anchor - 7 * DAY + 11 * 3_600_000),
      submittedAt: iso(anchor - 7 * DAY + 12 * 3_600_000),
      approval: "APPROVED",
      bankCode: "BK26-A7KQ-M9TX",
      reviewedAt: iso(anchor - 6 * DAY + 15 * 3_600_000),
      reviewedBy: AOSA_PAYMENTS_DESK,
      note: "",
    },
    {
      id: "fee-app-1002",
      applicationId: "app-1002",
      applicationRef: "app-1002",
      studentId: "portal-app-1002",
      firstName: "Paul",
      lastName: "Nguemo",
      email: "paul.n@example.com",
      institutionId: "inst-2",
      programName: "HND Electrical Engineering",
      method: "Mobile money",
      reference: "OM-26-5518240",
      receiptFile: null,
      applicationFee: 10000,
      webFee: 2000,
      amount: 12000,
      paidAt: iso(anchor - 1 * DAY + 16 * 3_600_000),
      submittedAt: iso(anchor - 1 * DAY + 17 * 3_600_000),
      approval: "AWAITING",
      bankCode: null,
      reviewedAt: null,
      reviewedBy: null,
      note: "",
    }
  );

  return out;
}

export const feePaymentStore = createCollection<FeePayment>("application-fee-payments", seedFees);

// ---------------------------------------------------------------------------
// Admin actions (record keeping only)
// ---------------------------------------------------------------------------

export function approveFeePayment(id: string, reviewer: string, note = "") {
  const now = new Date();
  const taken = new Set(feePaymentStore.getAll().map((f) => f.bankCode).filter(Boolean));
  let code = makeBankCode("A", now.getUTCFullYear());
  while (taken.has(code)) code = makeBankCode("A", now.getUTCFullYear());
  feePaymentStore.update(id, { approval: "APPROVED", bankCode: code, reviewedAt: now.toISOString(), reviewedBy: reviewer, note: note.trim() });
  return code;
}

export function rejectFeePayment(id: string, reviewer: string, note: string) {
  feePaymentStore.update(id, { approval: "REJECTED", bankCode: null, reviewedAt: new Date().toISOString(), reviewedBy: reviewer, note: note.trim() });
}

export function reopenFeePayment(id: string) {
  feePaymentStore.update(id, { approval: "AWAITING", bankCode: null, reviewedAt: null, reviewedBy: null, note: "" });
}

// ---------------------------------------------------------------------------
// Institution view (see ./privacy.ts)
// ---------------------------------------------------------------------------

export type InstitutionFeeView =
  | { state: "AWAITING"; id: string; applicationId: string; displayName: string }
  | {
      state: "PAID";
      id: string;
      applicationId: string;
      applicationRef: string;
      displayName: string;
      programName: string;
      bankCode: string;
      /** The institution's own fee only. The web fee is never included. */
      applicationFee: number;
      approvedAt: string;
    };

/**
 * A rejected payment reads as "awaiting payment" to the institution: the
 * student still owes the fee, and why AOSA rejected it is between AOSA and
 * the student.
 */
export function institutionFeeView(f: FeePayment): InstitutionFeeView {
  if (f.approval === "APPROVED" && f.bankCode && f.reviewedAt) {
    return {
      state: "PAID",
      id: f.id,
      applicationId: f.applicationId,
      applicationRef: f.applicationRef,
      displayName: `${f.firstName} ${f.lastName}`,
      programName: f.programName,
      bankCode: f.bankCode,
      applicationFee: f.applicationFee,
      approvedAt: f.reviewedAt,
    };
  }
  return { state: "AWAITING", id: f.id, applicationId: f.applicationId, displayName: maskName(f.firstName, f.lastName) };
}

/** Latest fee record for one application at one institution. */
export function feeFor(all: FeePayment[], applicationId: string, institutionId: string): FeePayment | undefined {
  return all
    .filter((f) => f.applicationId === applicationId && f.institutionId === institutionId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
}
