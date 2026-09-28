import { createCollection, mockAnchor, newId, seededRandom } from "@/lib/admin/store";
import { paramId } from "@/lib/admin/parameters";
import { SEED_INSTITUTIONS } from "@/lib/admin/institutions";
import { seedAdminRecords } from "@/lib/admin/students";

/**
 * Tuition verification for admitted students.
 *
 * This is a record-keeping and checking workflow only. No money moves on
 * the platform: a student (or the bursary) records a payment they have
 * already made outside it — a bank deposit, a mobile money transfer — and
 * the institution checks it against its own statement and marks it
 * verified, queried or rejected. The AOSA administration can see every
 * institution's accounts and review payments too.
 *
 * Only VERIFIED payments count towards what a student has paid off.
 */

export type PaymentRecordStatus = "PENDING" | "QUERIED" | "VERIFIED" | "REJECTED";
export type ReviewAction = "RECORDED" | "VERIFIED" | "QUERIED" | "REJECTED" | "REOPENED" | "ANSWERED";
export type ReviewerRole = "student" | "institution" | "admin";

export interface TuitionReview {
  at: string;
  action: ReviewAction;
  by: string;
  role: ReviewerRole;
  reasonId?: string;
  note: string;
}

export interface TuitionPayment {
  id: string;
  /** payment-method-types parameter id */
  methodId: string;
  reference: string;
  amount: number;
  paidOn: string;
  payerName: string;
  receiptFile: string | null;
  recordedAt: string;
  status: PaymentRecordStatus;
  reviews: TuitionReview[];
}

export interface Instalment {
  label: string;
  dueDate: string;
  amount: number;
}

export interface TuitionAccount {
  id: string;
  applicationId: string;
  applicationRef: string;
  studentId: string;
  studentName: string;
  registrationNo: string;
  email: string;
  phone: string;
  institutionId: string;
  programName: string;
  academicYearId: string;
  feeCategoryId: string;
  tuitionAmount: number;
  admittedAt: string;
  offerAccepted: boolean;
  instalments: Instalment[];
  payments: TuitionPayment[];
}

// ---------------------------------------------------------------------------
// Derived figures
// ---------------------------------------------------------------------------

export type PaymentStatus = "NOT_PAID" | "PART_PAID" | "PAID" | "OVERPAID";
export type VerificationStatus = "NO_PAYMENTS" | "AWAITING" | "QUERIED" | "PARTLY_VERIFIED" | "VERIFIED" | "REJECTED";

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: "neutral" | "info" | "amber" | "success" | "danger" }> = {
  NOT_PAID: { label: "Not paid", tone: "danger" },
  PART_PAID: { label: "Part paid", tone: "amber" },
  PAID: { label: "Paid in full", tone: "success" },
  OVERPAID: { label: "Overpaid", tone: "info" },
};

export const VERIFICATION_META: Record<VerificationStatus, { label: string; tone: "neutral" | "info" | "amber" | "success" | "danger"; description: string }> = {
  NO_PAYMENTS: { label: "No payments recorded", tone: "neutral", description: "Nothing to verify yet." },
  AWAITING: { label: "Awaiting verification", tone: "info", description: "At least one payment needs checking." },
  QUERIED: { label: "Query open", tone: "amber", description: "The institution asked the student about a payment." },
  PARTLY_VERIFIED: { label: "Partly verified", tone: "amber", description: "Verified payments don't yet cover the tuition." },
  VERIFIED: { label: "Fully verified", tone: "success", description: "Verified payments cover the full tuition." },
  REJECTED: { label: "Payments rejected", tone: "danger", description: "Every payment recorded so far was rejected." },
};

export const RECORD_STATUS_META: Record<PaymentRecordStatus, { label: string; tone: "neutral" | "info" | "amber" | "success" | "danger" }> = {
  PENDING: { label: "Awaiting verification", tone: "info" },
  QUERIED: { label: "Queried", tone: "amber" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const REVIEW_LABELS: Record<ReviewAction, string> = {
  RECORDED: "Payment recorded",
  VERIFIED: "Verified",
  QUERIED: "Query raised",
  ANSWERED: "Query answered",
  REJECTED: "Rejected",
  REOPENED: "Reopened for review",
};

export interface TuitionFigures {
  tuition: number;
  /** Everything recorded except rejected payments. */
  recorded: number;
  verified: number;
  awaiting: number;
  outstanding: number;
  paymentStatus: PaymentStatus;
  verificationStatus: VerificationStatus;
  pendingCount: number;
  /** Oldest payment still waiting for a decision. */
  oldestPendingAt: string | null;
  nextInstalment: (Instalment & { covered: number; overdue: boolean }) | null;
}

export function figures(a: TuitionAccount, today = mockAnchor().toISOString().slice(0, 10)): TuitionFigures {
  const live = a.payments.filter((p) => p.status !== "REJECTED");
  const recorded = live.reduce((s, p) => s + p.amount, 0);
  const verified = a.payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
  const waiting = a.payments.filter((p) => p.status === "PENDING" || p.status === "QUERIED");
  const awaiting = waiting.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, a.tuitionAmount - verified);

  const paymentStatus: PaymentStatus =
    recorded === 0 ? "NOT_PAID" : recorded < a.tuitionAmount ? "PART_PAID" : recorded === a.tuitionAmount ? "PAID" : "OVERPAID";

  let verificationStatus: VerificationStatus;
  if (a.payments.length === 0) verificationStatus = "NO_PAYMENTS";
  else if (a.payments.some((p) => p.status === "QUERIED")) verificationStatus = "QUERIED";
  else if (a.payments.some((p) => p.status === "PENDING")) verificationStatus = "AWAITING";
  else if (verified >= a.tuitionAmount) verificationStatus = "VERIFIED";
  else if (verified > 0) verificationStatus = "PARTLY_VERIFIED";
  else verificationStatus = "REJECTED";

  // Instalments are covered in order by verified money.
  let pool = verified;
  let nextInstalment: TuitionFigures["nextInstalment"] = null;
  for (const inst of a.instalments) {
    const covered = Math.min(pool, inst.amount);
    pool -= covered;
    if (covered < inst.amount && !nextInstalment) nextInstalment = { ...inst, covered, overdue: inst.dueDate < today };
  }

  const oldestPendingAt = waiting.map((p) => p.recordedAt).sort()[0] ?? null;

  return { tuition: a.tuitionAmount, recorded, verified, awaiting, outstanding, paymentStatus, verificationStatus, pendingCount: waiting.length, oldestPendingAt, nextInstalment };
}

/** Coverage of each instalment by verified payments, for the schedule table. */
export function instalmentCoverage(a: TuitionAccount) {
  let pool = a.payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
  const today = mockAnchor().toISOString().slice(0, 10);
  return a.instalments.map((inst) => {
    const covered = Math.min(pool, inst.amount);
    pool -= covered;
    return { ...inst, covered, state: covered >= inst.amount ? ("covered" as const) : inst.dueDate < today ? ("overdue" as const) : covered > 0 ? ("part" as const) : ("due" as const) };
  });
}

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const TUITION_BY_TYPE: Record<string, number> = { UNI: 450000, VOC: 350000, PRO: 520000, HS: 120000, SS: 85000 };
const MULTIPLIER: Record<string, number> = { NAT: 1, CEMAC: 1.25, INT: 2 };
const METHODS = ["MTN-MOMO", "ORANGE-MONEY", "BANK", "TRANSFER", "CASH"];
const REF_PREFIX: Record<string, string> = { "MTN-MOMO": "MTN", "ORANGE-MONEY": "OM", BANK: "AFB", TRANSFER: "EU", CASH: "RCT" };

const STAFF: Record<string, string> = { "inst-1": "Brenda Ngwa (Bursary)" };
const staffFor = (instId: string) => STAFF[instId] ?? "Bursary office";

type Scenario = "none" | "pending" | "verified+pending" | "full" | "partial" | "rejected+pending" | "queried" | "overpaid";
const SCENARIOS: [Scenario, number][] = [
  ["none", 14], ["pending", 20], ["verified+pending", 18], ["full", 18], ["partial", 12], ["rejected+pending", 8], ["queried", 7], ["overpaid", 3],
];

function round(n: number, step = 5000) {
  return Math.round(n / step) * step;
}

function seedTuition(): TuitionAccount[] {
  const rnd = seededRandom(707);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const weighted = <T,>(pairs: [T, number][]) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    for (const [v, w] of pairs) if ((r -= w) < 0) return v;
    return pairs[pairs.length - 1][0];
  };
  const today = mockAnchor().getTime();
  const iso = (t: number) => new Date(t).toISOString();
  const day = (t: number) => iso(t).slice(0, 10);

  const { students, applications } = seedAdminRecords();
  const studentIndex = new Map(students.map((s) => [s.id, s]));
  const typeOf = new Map(SEED_INSTITUTIONS.map((i) => [i.id, i.typeCode]));
  const out: TuitionAccount[] = [];

  const admitted = applications.filter((a) => a.status === "ACCEPTED" || a.status === "A_ACKNOWLEDGED");

  // The demo institution (inst-1, the institution portal's account) gets a
  // fuller queue than the random generator happens to give it.
  const taken = new Set(admitted.map((a) => a.studentId));
  const uniPrograms = ["BSc Computer Science", "BSc Management", "LLB Law", "BSc Economics", "BEng Civil Engineering", "BSc Biology"];
  students
    .filter((st) => !taken.has(st.id))
    .slice(0, 9)
    .forEach((st, k) => {
      const at = new Date(today - (12 + k * 5) * DAY + 10 * 3_600_000).toISOString();
      admitted.push({
        ...applications[0],
        id: `app-x${String(k + 1).padStart(4, "0")}`,
        reference: `APP-26-9${String(k + 1).padStart(4, "0")}`,
        studentId: st.id,
        institutionId: "inst-1",
        programName: uniPrograms[k % uniPrograms.length],
        status: k % 3 === 2 ? "ACCEPTED" : "A_ACKNOWLEDGED",
        history: [{ status: "ACCEPTED", at, actor: "institution", note: "" }],
        payment: null,
      });
    });
  admitted.forEach((app, idx) => {
    const s = studentIndex.get(app.studentId);
    if (!s) return;
    const acceptedAt = new Date(app.history.find((h) => h.status === "ACCEPTED")!.at).getTime();
    const category = weighted<string>([["NAT", 80], ["CEMAC", 12], ["INT", 8]]);
    const tuition = round((TUITION_BY_TYPE[typeOf.get(app.institutionId) ?? "UNI"] ?? 400000) * MULTIPLIER[category]);
    const splits = tuition >= 300000 ? [0.4, 0.3, 0.3] : [0.5, 0.5];
    const instalments: Instalment[] = splits.map((f, i) => ({
      label: i === 0 ? "First instalment" : i === 1 ? "Second instalment" : "Final instalment",
      dueDate: day(acceptedAt + (21 + i * 60) * DAY),
      amount: i === splits.length - 1 ? tuition - splits.slice(0, -1).reduce((s2, x) => s2 + round(tuition * x), 0) : round(tuition * f),
    }));

    const payments: TuitionPayment[] = [];
    const reviewer = staffFor(app.institutionId);
    const payerName = `${s.firstName} ${s.lastName}`;
    const family = s.lastName;
    const scenario = weighted(SCENARIOS);
    // Payments happen between acceptance and yesterday.
    const window = Math.max(DAY, today - DAY - acceptedAt);
    const when = (frac: number) => Math.min(today - DAY / 2, acceptedAt + Math.floor(window * frac) + 9 * 3_600_000);
    let seq = 0;

    function pay(amount: number, at: number, status: PaymentRecordStatus, extra: Partial<TuitionPayment> = {}) {
      seq += 1;
      const methodCode = pick(METHODS);
      const recordedAt = at + Math.floor(rnd() * 6) * 3_600_000;
      const reviews: TuitionReview[] = [{ at: iso(recordedAt), action: "RECORDED", by: payerName, role: "student", note: "" }];
      const reviewAt = Math.min(recordedAt + (1 + Math.floor(rnd() * 3)) * DAY, today - 3_600_000);
      if (status === "VERIFIED") reviews.push({ at: iso(reviewAt), action: "VERIFIED", by: reviewer, role: "institution", note: "Matched on the bank statement." });
      if (status === "REJECTED") reviews.push({ at: iso(reviewAt), action: "REJECTED", by: reviewer, role: "institution", reasonId: paramId("rejection-reasons", "PAY-NOT-FOUND"), note: "No credit with this reference on our statement." });
      if (status === "QUERIED") reviews.push({ at: iso(reviewAt), action: "QUERIED", by: reviewer, role: "institution", note: "The amount on the receipt looks different from the amount recorded. Please upload a clearer copy." });
      payments.push({
        id: `${app.id}-pay-${seq}`,
        methodId: paramId("payment-method-types", methodCode),
        reference: `${REF_PREFIX[methodCode]}-${String(26)}-${String(1000000 + Math.floor(rnd() * 8999999))}`,
        amount,
        paidOn: day(at),
        payerName: rnd() < 0.2 ? `${pick(["Jean", "Marie", "Pierre", "Florence"])} ${family}` : payerName,
        receiptFile: rnd() < 0.85 ? `receipt-${app.reference.toLowerCase()}-${seq}.pdf` : null,
        recordedAt: iso(recordedAt),
        status,
        reviews,
        ...extra,
      });
    }

    const first = instalments[0].amount;
    switch (scenario) {
      case "pending": pay(first, when(0.5), "PENDING"); break;
      case "verified+pending": pay(first, when(0.25), "VERIFIED"); pay(instalments[1].amount, when(0.85), "PENDING"); break;
      case "full": pay(first, when(0.2), "VERIFIED"); pay(tuition - first, when(0.6), "VERIFIED"); break;
      case "partial": pay(first, when(0.35), "VERIFIED"); break;
      case "rejected+pending": pay(first, when(0.3), "REJECTED"); pay(first, when(0.8), "PENDING"); break;
      case "queried": pay(round(first * 0.9), when(0.5), "QUERIED"); break;
      case "overpaid": pay(tuition, when(0.3), "VERIFIED"); pay(round(first / 4), when(0.7), "PENDING"); break;
      default: break;
    }

    out.push({
      id: `tui-${String(idx + 1).padStart(4, "0")}`,
      applicationId: app.id,
      applicationRef: app.reference,
      studentId: s.id,
      studentName: payerName,
      registrationNo: s.registrationNo,
      email: s.email,
      phone: s.phone,
      institutionId: app.institutionId,
      programName: app.programName,
      academicYearId: paramId("academic-years", "2026-2027"),
      feeCategoryId: paramId("fee-categories", category),
      tuitionAmount: tuition,
      admittedAt: iso(acceptedAt),
      offerAccepted: app.status === "A_ACKNOWLEDGED",
      instalments,
      payments,
    });
  });

  // The demo student's own account (student portal), matching the
  // notifications he has received: 200 000 XAF verified yesterday.
  const admittedAt = today - 6 * DAY;
  out.unshift({
    id: DEMO_TUITION_ID,
    applicationId: "app-demo",
    applicationRef: "APP-26-01042",
    studentId: "stu-demo",
    studentName: "Nadège Mbarga",
    registrationNo: "CHT-2026-01042",
    email: "nadege.mbarga@example.cm",
    phone: "+237 677 21 43 90",
    institutionId: "inst-1",
    programName: "BSc Computer Science",
    academicYearId: paramId("academic-years", "2026-2027"),
    feeCategoryId: paramId("fee-categories", "NAT"),
    tuitionAmount: 450000,
    admittedAt: iso(admittedAt),
    offerAccepted: true,
    instalments: [
      { label: "First instalment", dueDate: day(today + 9 * DAY), amount: 180000 },
      { label: "Second instalment", dueDate: day(today + 69 * DAY), amount: 135000 },
      { label: "Final instalment", dueDate: day(today + 129 * DAY), amount: 135000 },
    ],
    payments: [
      {
        id: "demo-pay-1",
        methodId: paramId("payment-method-types", "BANK"),
        reference: "AFB-77120394",
        amount: 200000,
        paidOn: day(today - 3 * DAY),
        payerName: "Nadège Mbarga",
        receiptFile: "afriland-deposit-slip.pdf",
        recordedAt: iso(today - 3 * DAY + 11 * 3_600_000),
        status: "VERIFIED",
        reviews: [
          { at: iso(today - 3 * DAY + 11 * 3_600_000), action: "RECORDED", by: "Nadège Mbarga", role: "student", note: "" },
          { at: iso(today - 20 * 3_600_000), action: "VERIFIED", by: staffFor("inst-1"), role: "institution", note: "Matched on the Afriland statement." },
        ],
      },
    ],
  });

  return out;
}

export const DEMO_TUITION_ID = "tui-demo";

export const tuitionStore = createCollection<TuitionAccount>("tuition", seedTuition);

// ---------------------------------------------------------------------------
// Actions (record keeping only — nothing is charged or transferred)
// ---------------------------------------------------------------------------

export interface Reviewer {
  name: string;
  role: ReviewerRole;
}

const NEXT_STATUS: Record<Exclude<ReviewAction, "RECORDED">, PaymentRecordStatus> = {
  VERIFIED: "VERIFIED",
  QUERIED: "QUERIED",
  REJECTED: "REJECTED",
  REOPENED: "PENDING",
  ANSWERED: "PENDING",
};

export function reviewPayment(accountId: string, paymentId: string, action: Exclude<ReviewAction, "RECORDED">, reviewer: Reviewer, note: string, reasonId?: string) {
  const account = tuitionStore.getAll().find((a) => a.id === accountId);
  if (!account) return;
  const at = new Date().toISOString();
  tuitionStore.update(accountId, {
    payments: account.payments.map((p) =>
      p.id === paymentId
        ? { ...p, status: NEXT_STATUS[action], reviews: [...p.reviews, { at, action, by: reviewer.name, role: reviewer.role, reasonId, note: note.trim() }] }
        : p
    ),
  });
}

export function recordPayment(accountId: string, input: Pick<TuitionPayment, "methodId" | "reference" | "amount" | "paidOn" | "payerName" | "receiptFile">, recorder: Reviewer) {
  const account = tuitionStore.getAll().find((a) => a.id === accountId);
  if (!account) return;
  const at = new Date().toISOString();
  const payment: TuitionPayment = {
    ...input,
    id: newId("pay"),
    recordedAt: at,
    status: "PENDING",
    reviews: [{ at, action: "RECORDED", by: recorder.name, role: recorder.role, note: "" }],
  };
  tuitionStore.update(accountId, { payments: [...account.payments, payment] });
}

/** Is this reference already used on any non-rejected payment? */
export function referenceInUse(reference: string, exceptPaymentId?: string) {
  const r = reference.trim().toLowerCase();
  return tuitionStore
    .getAll()
    .flatMap((a) => a.payments.map((p) => ({ a, p })))
    .find(({ p }) => p.id !== exceptPaymentId && p.status !== "REJECTED" && p.reference.toLowerCase() === r);
}
