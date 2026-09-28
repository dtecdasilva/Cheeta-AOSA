import { createCollection, mockAnchor, seededRandom } from "@/lib/admin/store";
import { SEED_INSTITUTIONS } from "@/lib/admin/institutions";
import { figures, institutionTuitionView, tuitionSeed, DEMO_TUITION_ID, type TuitionAccount } from "@/lib/tuition/data";
import { clearanceFor, medicalSeed, recordsByAccount, type MedicalClearance, type MedicalRecord } from "@/lib/medical/data";
import type { Role } from "@/lib/auth/roles";

/**
 * Matriculation: the step that turns an admitted student into an enrolled
 * one, and gives them their matriculation code (the student number the
 * institution uses from then on).
 *
 * A student can be matriculated when all three hold:
 *   1. Admission — they have accepted the offer.
 *   2. Tuition   — AOSA has verified payments covering at least the first
 *                  instalment.
 *   3. Medical   — every medical requirement is verified and none is Unfit.
 *
 * The institution (or AOSA) then confirms matriculation, which issues the
 * code. Nothing here is computed on a server; the rules are repeated in
 * the backend phase.
 */

export type MatricStatus = "NOT_READY" | "READY" | "MATRICULATED";
export type AdmissionState = "ACCEPTED" | "AWAITING_REPLY";
export type TuitionClearance = "CLEARED" | "PAID_IN_FULL" | "NOT_CLEARED";

type Tone = "neutral" | "info" | "amber" | "success" | "danger";

export const MATRIC_STATUS_META: Record<MatricStatus, { label: string; tone: Tone }> = {
  NOT_READY: { label: "Requirements outstanding", tone: "neutral" },
  READY: { label: "Ready to matriculate", tone: "info" },
  MATRICULATED: { label: "Matriculated", tone: "success" },
};

export const ADMISSION_META: Record<AdmissionState, { label: string; tone: Tone }> = {
  ACCEPTED: { label: "Offer accepted", tone: "success" },
  AWAITING_REPLY: { label: "Awaiting student's reply", tone: "amber" },
};

export const TUITION_CLEARANCE_META: Record<TuitionClearance, { label: string; tone: Tone }> = {
  PAID_IN_FULL: { label: "Paid in full", tone: "success" },
  CLEARED: { label: "First instalment verified", tone: "success" },
  NOT_CLEARED: { label: "Not cleared", tone: "amber" },
};

export const MATRIC_CONFIRM_ROLES: Role[] = ["AOSA_ADMIN", "INSTITUTION_ADMIN"];
export const canConfirmMatriculation = (role: Role) => MATRIC_CONFIRM_ROLES.includes(role);

export interface MatriculationRecord {
  /** Same as the tuition account id. */
  id: string;
  code: string;
  matriculatedAt: string;
  confirmedBy: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function tuitionClearance(a: TuitionAccount): TuitionClearance {
  const f = figures(a);
  if (f.verified >= a.tuitionAmount) return "PAID_IN_FULL";
  const first = a.instalments[0]?.amount ?? a.tuitionAmount;
  return f.verified >= first ? "CLEARED" : "NOT_CLEARED";
}

export interface MatricRow {
  account: TuitionAccount;
  admission: AdmissionState;
  tuition: TuitionClearance;
  medical: MedicalClearance;
  medicalRecords: MedicalRecord[];
  status: MatricStatus;
  record: MatriculationRecord | null;
  /** What still stands in the way, in plain words. Empty when ready. */
  blockers: string[];
  /** True when the institution portal must mask this student (tuition awaiting AOSA). */
  maskedForInstitution: boolean;
}

export function buildRow(account: TuitionAccount, medicalRecords: MedicalRecord[], record: MatriculationRecord | undefined): MatricRow {
  const admission: AdmissionState = account.offerAccepted ? "ACCEPTED" : "AWAITING_REPLY";
  const tuition = tuitionClearance(account);
  const medical = clearanceFor(medicalRecords);
  const blockers: string[] = [];
  if (admission !== "ACCEPTED") blockers.push("Student hasn't accepted the offer");
  if (tuition === "NOT_CLEARED") blockers.push("First tuition instalment not verified by AOSA");
  if (medical === "NOT_CLEARED") blockers.push("A medical requirement was found Unfit");
  else if (medical !== "CLEARED") blockers.push("Medical verification not complete");
  const status: MatricStatus = record ? "MATRICULATED" : blockers.length === 0 ? "READY" : "NOT_READY";
  return { account, admission, tuition, medical, medicalRecords, status, record: record ?? null, blockers, maskedForInstitution: institutionTuitionView(account).masked };
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

const SMALL_WORDS = new Set(["of", "de", "du", "des", "la", "le", "d", "and", "et", "in", "the"]);
const DEGREE = /^(BSc|BA|BEng|LLB|HND|CAP|BTS|Diploma in|Lower Sixth|Première|Form \d)\s*[—-]?\s*/i;

function initials(words: string[], max: number) {
  return words
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()))
    .map((w) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0])
    .join("")
    .toUpperCase()
    .slice(0, max);
}

export function institutionAbbr(name: string) {
  return initials(name.split(/[\s'’-]+/), 4) || "INS";
}

export function programAbbr(program: string) {
  const rest = program.replace(DEGREE, "").trim() || program;
  const words = rest.split(/\s+/);
  if (words.length === 1) return words[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toUpperCase();
  return initials(words, 3);
}

/** e.g. MFU/26/CS/0142 — institution, intake year, program, sequence. */
export function makeMatricCode(institutionName: string, programName: string, year: number, seq: number) {
  return `${institutionAbbr(institutionName)}/${String(year).slice(2)}/${programAbbr(programName)}/${String(seq).padStart(4, "0")}`;
}

function nextSeq(records: MatriculationRecord[], prefix: string) {
  const used = records.filter((r) => r.code.startsWith(prefix)).map((r) => Number(r.code.split("/").pop()) || 0);
  return (used.length ? Math.max(...used) : 100) + 1;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const INST_NAME = new Map(SEED_INSTITUTIONS.map((i) => [i.id, i.name]));

function seedMatric(): MatriculationRecord[] {
  const rnd = seededRandom(9090);
  const anchor = mockAnchor().getTime();
  const byAccount = recordsByAccount(medicalSeed());
  const out: MatriculationRecord[] = [];
  for (const a of tuitionSeed()) {
    if (a.id === DEMO_TUITION_ID) continue;
    const row = buildRow(a, byAccount.get(a.id) ?? [], undefined);
    if (row.status !== "READY" || rnd() > 0.62) continue;
    const year = new Date(a.admittedAt).getUTCFullYear();
    const instName = INST_NAME.get(a.institutionId) ?? "Institution";
    const prefix = `${institutionAbbr(instName)}/${String(year).slice(2)}/${programAbbr(a.programName)}/`;
    const lastMedical = (byAccount.get(a.id) ?? []).map((m) => m.verificationDate ?? "").sort().pop() ?? a.admittedAt;
    const at = Math.min(anchor - 3_600_000, new Date(lastMedical).getTime() + (1 + Math.floor(rnd() * 4)) * 86_400_000);
    out.push({
      id: a.id,
      code: prefix + String(nextSeq(out, prefix)).padStart(4, "0"),
      matriculatedAt: new Date(at).toISOString(),
      confirmedBy: "Registrar's office",
      note: "",
    });
  }
  return out;
}

export const matriculationStore = createCollection<MatriculationRecord>("matriculation", seedMatric);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function confirmMatriculation(row: MatricRow, institutionName: string, by: { name: string; role: Role }, note = ""): MatriculationRecord | null {
  if (!canConfirmMatriculation(by.role) || row.status !== "READY") return null;
  const all = matriculationStore.getAll();
  if (all.some((r) => r.id === row.account.id)) return null;
  const year = new Date(row.account.admittedAt).getUTCFullYear();
  const prefix = makeMatricCode(institutionName, row.account.programName, year, 0).replace(/0000$/, "");
  const record: MatriculationRecord = {
    id: row.account.id,
    code: prefix + String(nextSeq(all, prefix)).padStart(4, "0"),
    matriculatedAt: new Date().toISOString(),
    confirmedBy: by.name,
    note: note.trim(),
  };
  matriculationStore.add(record);
  return record;
}

/** Reverses a matriculation confirmed in error. */
export function revokeMatriculation(id: string, by: { role: Role }) {
  if (!canConfirmMatriculation(by.role)) return;
  matriculationStore.remove(id);
}
