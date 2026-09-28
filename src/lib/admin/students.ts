import type { ApplicationStatus } from "@/lib/types";
import { createCollection, mockAnchor, seededRandom } from "./store";
import { paramId } from "./parameters";
import { SEED_INSTITUTIONS } from "./institutions";

export type Gender = "Male" | "Female";

export interface AdminStudent {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  email: string;
  phone: string;
  regionId: string;
  townId: string;
  address: string;
  highestQualification: string;
  registeredAt: string;
  source: "Self-registered" | "Registered by admin";
}

export type EventActor = "applicant" | "institution" | "system" | "admin";

export interface StatusEvent {
  status: ApplicationStatus;
  at: string;
  actor: EventActor;
  note: string;
}

export type PaymentStatus = "PAID" | "PENDING" | "FAILED";

export interface ApplicationPayment {
  method: string;
  reference: string;
  amount: number;
  applicationFee: number;
  webFee: number;
  status: PaymentStatus;
  initiatedAt: string;
  paidAt: string | null;
}

export interface AdminApplication {
  id: string;
  reference: string;
  studentId: string;
  institutionId: string;
  programName: string;
  createdAt: string;
  updatedAt: string;
  status: ApplicationStatus;
  /** Every status the application has been through, oldest first. */
  history: StatusEvent[];
  payment: ApplicationPayment | null;
}

// ---------------------------------------------------------------------------
// Deterministic generator
// ---------------------------------------------------------------------------

const FEMALE = ["Aïssatou", "Chantal", "Brenda", "Mireille", "Esther", "Nadège", "Grace", "Clarisse", "Hadiza", "Linda", "Pélagie", "Vanessa", "Ruth", "Sandrine", "Blessing", "Joséphine"];
const MALE = ["Paul", "Emmanuel", "Boris", "Ibrahim", "Junior", "Serge", "Kevin", "Hervé", "Aboubakar", "Christian", "Franck", "Divine", "Loïc", "Samuel", "Arnaud", "Wilfried"];
const LAST = ["Mballa", "Nguemo", "Fouda", "Tchoua", "Ekwalla", "Ngwa", "Ayuk", "Abena", "Owona", "Bello", "Fotso", "Mvondo", "Tabi", "Njoya", "Kamga", "Etoundi", "Nkeng", "Achu", "Fon", "Hamadou", "Manga", "Essomba", "Tanyi", "Djoumessi"];

/** [town code, region code, anglophone?] — weighted towards the big cities. */
const HOMES: [string, string, boolean][] = [
  ["YDE", "CE", false], ["YDE", "CE", false], ["YDE", "CE", false], ["DLA", "LT", false], ["DLA", "LT", false],
  ["DLA", "LT", false], ["BDA", "NW", true], ["BDA", "NW", true], ["BUE", "SW", true], ["LMB", "SW", true],
  ["KBA", "SW", true], ["BFM", "WE", false], ["DSC", "WE", false], ["NGD", "AD", false], ["GOU", "NO", false],
  ["MRA", "EN", false], ["EBW", "SU", false], ["KRI", "SU", false], ["BTA", "ES", false], ["MBM", "CE", false],
];

const PROGRAMS: Record<string, string[]> = {
  UNI: ["BSc Computer Science", "BSc Biology", "BSc Management", "LLB Law", "BSc Economics", "BEng Civil Engineering"],
  HS: ["Lower Sixth — Science", "Lower Sixth — Arts", "Première C", "Première D"],
  SS: ["Form 1", "Sixième", "Form 4 — Science"],
  VOC: ["HND Electrical Engineering", "HND Civil Engineering", "CAP Mechanics", "HND Agribusiness"],
  PRO: ["Diploma in Nursing", "Diploma in Midwifery", "BTS Accounting", "BTS Logistics"],
};

/** Application fee by institution type, in XAF. Matches src/lib/data.ts for inst-1…4. */
const APPLICATION_FEE: Record<string, number> = { UNI: 15000, HS: 5000, SS: 3000, VOC: 10000, PRO: 18000 };

const PAYMENT_METHODS = ["MTN Mobile Money", "Orange Money", "Bank transfer", "Debit wallet", "Money transfer"];

const REJECTION_REASONS = [
  "Grades below the program's entry requirement.",
  "Required documents were not provided.",
  "Program capacity reached.",
  "Prerequisite subjects missing from results.",
];

type Outcome = ApplicationStatus;
const OUTCOME_WEIGHTS: [Outcome, number][] = [
  ["INCOMPLETE", 14], ["COMPLETED", 10], ["SUBMITTED", 17], ["I_ACKNOWLEDGED", 16], ["I_REJECTED", 11],
  ["ACCEPTED", 14], ["A_ACKNOWLEDGED", 10], ["A_REJECTED", 4], ["RESUBMITTED", 4],
];

const PATHS: Record<Outcome, ApplicationStatus[]> = {
  INCOMPLETE: ["INCOMPLETE"],
  COMPLETED: ["INCOMPLETE", "COMPLETED"],
  SUBMITTED: ["INCOMPLETE", "COMPLETED", "SUBMITTED"],
  I_ACKNOWLEDGED: ["INCOMPLETE", "COMPLETED", "SUBMITTED", "I_ACKNOWLEDGED"],
  I_REJECTED: ["INCOMPLETE", "COMPLETED", "SUBMITTED", "I_ACKNOWLEDGED", "I_REJECTED"],
  ACCEPTED: ["INCOMPLETE", "COMPLETED", "SUBMITTED", "I_ACKNOWLEDGED", "ACCEPTED"],
  A_ACKNOWLEDGED: ["INCOMPLETE", "COMPLETED", "SUBMITTED", "I_ACKNOWLEDGED", "ACCEPTED", "A_ACKNOWLEDGED"],
  A_REJECTED: ["INCOMPLETE", "COMPLETED", "SUBMITTED", "I_ACKNOWLEDGED", "ACCEPTED", "A_REJECTED"],
  RESUBMITTED: ["INCOMPLETE", "COMPLETED", "SUBMITTED", "I_ACKNOWLEDGED", "RESUBMITTED"],
};

const ACTOR: Record<ApplicationStatus, EventActor> = {
  INCOMPLETE: "applicant",
  COMPLETED: "applicant",
  SUBMITTED: "applicant",
  RESUBMITTED: "applicant",
  I_ACKNOWLEDGED: "institution",
  I_REJECTED: "institution",
  ACCEPTED: "institution",
  A_ACKNOWLEDGED: "applicant",
  A_REJECTED: "applicant",
};

function strip(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const DAY = 86_400_000;

function generate(): { students: AdminStudent[]; applications: AdminApplication[] } {
  const rnd = seededRandom(20260926);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const weighted = <T,>(pairs: [T, number][]) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    for (const [v, w] of pairs) {
      if ((r -= w) < 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };

  const anchor = mockAnchor().getTime();
  const openInstitutions = SEED_INSTITUTIONS.filter((i) => i.status === "ACTIVE");
  const students: AdminStudent[] = [];
  const applications: AdminApplication[] = [];
  let appSeq = 0;

  for (let i = 0; i < 84; i++) {
    const gender: Gender = rnd() < 0.52 ? "Female" : "Male";
    const firstName = pick(gender === "Female" ? FEMALE : MALE);
    const lastName = pick(LAST);
    const [town, region, anglophone] = pick(HOMES);
    // Registrations cluster in the last few months, as an intake season would.
    const daysAgo = Math.floor(Math.pow(rnd(), 1.4) * 170);
    const registeredAt = anchor - daysAgo * DAY + Math.floor(rnd() * 12 + 7) * 3_600_000;
    const year = new Date(registeredAt).getUTCFullYear();
    const birthYear = 1999 + Math.floor(rnd() * 10);
    const id = `stu-${String(i + 1).padStart(4, "0")}`;

    students.push({
      id,
      registrationNo: `CHT-${year}-${String(i + 1).padStart(5, "0")}`,
      firstName,
      lastName,
      gender,
      dateOfBirth: `${birthYear}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
      email: `${strip(firstName)}.${strip(lastName)}${i + 1}@example.com`,
      phone: `+237 6${Math.floor(50 + rnd() * 49)} ${Math.floor(10 + rnd() * 89)} ${Math.floor(10 + rnd() * 89)} ${Math.floor(10 + rnd() * 89)}`,
      regionId: paramId("regions", region),
      townId: paramId("towns", town),
      address: `BP ${100 + Math.floor(rnd() * 900)}`,
      highestQualification: anglophone
        ? pick(["GCE Advanced Level", "GCE Advanced Level", "GCE Ordinary Level"])
        : pick(["BAC C", "BAC D", "BAC A", "Probatoire D", "BEPC"]),
      registeredAt: new Date(registeredAt).toISOString(),
      source: rnd() < 0.1 ? "Registered by admin" : "Self-registered",
    });

    const appCount = weighted<number>([[0, 14], [1, 44], [2, 29], [3, 13]]);
    const chosen = new Set<string>();
    for (let a = 0; a < appCount; a++) {
      const inst = pick(openInstitutions);
      if (chosen.has(inst.id)) continue;
      chosen.add(inst.id);
      appSeq += 1;

      let t = Math.min(registeredAt + Math.floor(rnd() * 9) * DAY + Math.floor(rnd() * 8) * 3_600_000, anchor - 3_600_000);
      const program = pick(PROGRAMS[inst.typeCode] ?? PROGRAMS.UNI);
      const history: StatusEvent[] = [];
      for (const status of PATHS[weighted(OUTCOME_WEIGHTS)]) {
        if (history.length > 0) t += Math.floor((1 + rnd() * 6) * DAY);
        // A recent application can't have got further than today.
        if (t > anchor + DAY) break;
        history.push({ status, at: new Date(t).toISOString(), actor: ACTOR[status], note: noteFor(status, program, pick) });
      }

      const reached = new Set(history.map((h) => h.status));
      const applicationFee = APPLICATION_FEE[inst.typeCode] ?? 10000;
      const amount = applicationFee + inst.webFee;
      let payment: ApplicationPayment | null = null;
      const completedAt = history.find((h) => h.status === "COMPLETED")?.at;
      if (reached.has("SUBMITTED") && completedAt) {
        const submittedAt = new Date(history.find((h) => h.status === "SUBMITTED")!.at).getTime();
        const paidAt = new Date(Math.max(new Date(completedAt).getTime(), submittedAt - 5 * 3_600_000)).toISOString();
        payment = { method: pick(PAYMENT_METHODS), reference: `PAY-${String(100000 + appSeq * 37).slice(-6)}`, amount, applicationFee, webFee: inst.webFee, status: "PAID", initiatedAt: paidAt, paidAt };
      } else if (reached.has("COMPLETED") && completedAt) {
        const roll = rnd();
        if (roll < 0.65) {
          payment = { method: pick(PAYMENT_METHODS), reference: `PAY-${String(100000 + appSeq * 37).slice(-6)}`, amount, applicationFee, webFee: inst.webFee, status: roll < 0.45 ? "PENDING" : "FAILED", initiatedAt: completedAt, paidAt: null };
        }
      }

      const last = history[history.length - 1];
      applications.push({
        id: `app-${String(appSeq).padStart(5, "0")}`,
        reference: `APP-${String(new Date(history[0].at).getUTCFullYear()).slice(2)}-${String(appSeq).padStart(5, "0")}`,
        studentId: id,
        institutionId: inst.id,
        programName: program,
        createdAt: history[0].at,
        updatedAt: last.at,
        status: last.status,
        history,
        payment,
      });
    }
  }

  return { students, applications };
}

function noteFor(status: ApplicationStatus, program: string, pick: <T>(arr: T[]) => T): string {
  switch (status) {
    case "INCOMPLETE":
      return `Started an application for ${program}.`;
    case "COMPLETED":
      return "All sections completed.";
    case "SUBMITTED":
      return "Submitted to the institution.";
    case "RESUBMITTED":
      return "Resubmitted with corrected documents.";
    case "I_ACKNOWLEDGED":
      return "Admissions office confirmed receipt.";
    case "I_REJECTED":
      return pick(REJECTION_REASONS);
    case "ACCEPTED":
      return `Admission offered for ${program}.`;
    case "A_ACKNOWLEDGED":
      return "Applicant accepted the offer.";
    case "A_REJECTED":
      return "Applicant declined the offer.";
  }
}

let generated: ReturnType<typeof generate> | null = null;
function data() {
  return (generated ??= generate());
}

export const studentStore = createCollection<AdminStudent>("students", () => data().students);
export const applicationStore = createCollection<AdminApplication>("applications", () => data().applications);

export function studentName(s: Pick<AdminStudent, "firstName" | "lastName"> | undefined) {
  return s ? `${s.firstName} ${s.lastName}` : "Unknown student";
}

/** The generated seed records, for other mock domains built on them (tuition). */
export function seedAdminRecords() {
  return data();
}
