import { createCollection, mockAnchor, seededRandom } from "@/lib/admin/store";
import { SEED_INSTITUTIONS } from "@/lib/admin/institutions";
import { tuitionSeed, DEMO_TUITION_ID } from "@/lib/tuition/data";
import type { Role } from "@/lib/auth/roles";

/**
 * Medical verification for admitted students.
 *
 * Each institution type asks for a set of medical requirements (a fitness
 * certificate, a vaccination, a screening). The student gets each one done
 * at an approved centre; an authorised user then records whether it has
 * been verified and what the outcome was. Only the outcome is kept here —
 * Fit, Fit with conditions, Unfit — never clinical detail.
 *
 * A student is medically cleared when every requirement is verified and
 * none is Unfit. Clearance is one of the conditions for matriculation.
 */

export type MedicalStatus = "NOT_STARTED" | "SCHEDULED" | "AWAITING" | "VERIFIED" | "RETEST";
export type MedicalResult = "FIT" | "CONDITIONAL" | "UNFIT";
export type MedicalClearance = "CLEARED" | "IN_PROGRESS" | "NOT_CLEARED";

type Tone = "neutral" | "info" | "amber" | "success" | "danger";

export const MEDICAL_STATUS_META: Record<MedicalStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  SCHEDULED: { label: "Examination booked", tone: "info" },
  AWAITING: { label: "Awaiting verification", tone: "info" },
  VERIFIED: { label: "Verified", tone: "success" },
  RETEST: { label: "Retest required", tone: "amber" },
};

export const MEDICAL_RESULT_META: Record<MedicalResult, { label: string; tone: Tone }> = {
  FIT: { label: "Fit", tone: "success" },
  CONDITIONAL: { label: "Fit with conditions", tone: "amber" },
  UNFIT: { label: "Unfit", tone: "danger" },
};

export const CLEARANCE_META: Record<MedicalClearance, { label: string; tone: Tone }> = {
  CLEARED: { label: "Medically cleared", tone: "success" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  NOT_CLEARED: { label: "Not cleared", tone: "danger" },
};

export interface MedicalRequirement {
  code: string;
  label: string;
  description: string;
}

export const MEDICAL_REQUIREMENTS: MedicalRequirement[] = [
  { code: "MED-FIT", label: "General medical fitness", description: "Medical fitness certificate from an approved centre, issued in the last 3 months." },
  { code: "HEP-B", label: "Hepatitis B vaccination", description: "Proof of a completed hepatitis B vaccination course or a negative screening." },
  { code: "TB-XRAY", label: "Chest X-ray (TB screening)", description: "Chest X-ray report ruling out active tuberculosis." },
  { code: "BLOOD", label: "Blood group and genotype", description: "Laboratory report of blood group and haemoglobin genotype." },
  { code: "EYE", label: "Eyesight test", description: "Visual acuity and colour vision test, for workshop and field programs." },
];

/** Which requirements each institution type asks for. */
const BY_TYPE: Record<string, string[]> = {
  UNI: ["MED-FIT", "HEP-B"],
  PRO: ["MED-FIT", "HEP-B", "TB-XRAY", "BLOOD"],
  VOC: ["MED-FIT", "EYE"],
  HS: ["MED-FIT"],
  SS: ["MED-FIT"],
};

export const requirementLabel = (code: string) => MEDICAL_REQUIREMENTS.find((r) => r.code === code)?.label ?? code;

export const MEDICAL_CENTRES = [
  "Centre Médical Universitaire, Yaoundé",
  "Hôpital Central de Yaoundé",
  "Hôpital Laquintinie, Douala",
  "Bamenda Regional Hospital",
  "Buea Regional Hospital",
  "Hôpital Régional de Bafoussam",
  "Institution medical centre",
];

export interface MedicalEvent {
  at: string;
  by: string;
  role: "institution" | "admin" | "student";
  status: MedicalStatus;
  result: MedicalResult | null;
  note: string;
}

export interface MedicalRecord {
  id: string;
  /** Tuition account id: the key for one admitted student at one institution. */
  accountId: string;
  studentName: string;
  registrationNo: string;
  applicationRef: string;
  institutionId: string;
  programName: string;
  requirementCode: string;
  status: MedicalStatus;
  result: MedicalResult | null;
  verificationDate: string | null;
  centre: string | null;
  certificateRef: string | null;
  note: string;
  history: MedicalEvent[];
}

/** Who may change a medical verification. Admission users can only look. */
export const MEDICAL_EDITOR_ROLES: Role[] = ["AOSA_ADMIN", "INSTITUTION_ADMIN"];
export const canEditMedical = (role: Role) => MEDICAL_EDITOR_ROLES.includes(role);

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

function seedMedical(): MedicalRecord[] {
  const rnd = seededRandom(3131);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const anchor = mockAnchor().getTime();
  const typeOf = new Map(SEED_INSTITUTIONS.map((i) => [i.id, i.typeCode]));
  const iso = (t: number) => new Date(t).toISOString();
  const out: MedicalRecord[] = [];
  const nurse = "Dr. Ruth Tabi (Medical centre)";

  for (const a of tuitionSeed()) {
    const codes = BY_TYPE[typeOf.get(a.institutionId) ?? "UNI"] ?? BY_TYPE.UNI;
    const admitted = new Date(a.admittedAt).getTime();
    // Students further along with tuition tend to be further along here too.
    const verifiedPayments = a.payments.filter((p) => p.status === "VERIFIED").length;
    const keen = Math.min(0.9, 0.35 + verifiedPayments * 0.25);

    codes.forEach((code, i) => {
      const id = `med-${a.id}-${code}`;
      let status: MedicalStatus;
      let result: MedicalResult | null = null;

      if (a.id === DEMO_TUITION_ID) {
        status = i === 0 ? "VERIFIED" : "AWAITING";
        result = i === 0 ? "FIT" : null;
      } else {
        const r = rnd();
        if (r < keen) {
          status = rnd() < 0.08 ? "RETEST" : "VERIFIED";
          const rr = rnd();
          result = status === "RETEST" ? null : rr < 0.86 ? "FIT" : rr < 0.97 ? "CONDITIONAL" : "UNFIT";
        } else if (r < keen + 0.2) status = "AWAITING";
        else if (r < keen + 0.3) status = "SCHEDULED";
        else status = "NOT_STARTED";
      }

      const window = Math.max(DAY, anchor - admitted);
      const doneAt = Math.min(anchor - 3_600_000, admitted + Math.floor(window * (0.3 + rnd() * 0.6)));
      const verificationDate = status === "VERIFIED" || status === "RETEST" ? iso(doneAt) : null;
      const centre = status === "NOT_STARTED" ? null : pick(MEDICAL_CENTRES);
      const certificateRef = status === "AWAITING" || status === "VERIFIED" || status === "RETEST" ? `MC-${String(26)}-${String(10000 + Math.floor(rnd() * 89999))}` : null;
      const note =
        result === "CONDITIONAL"
          ? "Fit for study. Excused from strenuous physical activity."
          : result === "UNFIT"
            ? "Referred to a specialist. Can be re-examined in 3 months."
            : status === "RETEST"
              ? "Report is older than 3 months. New examination needed."
              : "";

      const history: MedicalEvent[] = [];
      if (status !== "NOT_STARTED") {
        history.push({ at: iso(Math.max(admitted + DAY, doneAt - 4 * DAY)), by: a.studentName, role: "student", status: status === "SCHEDULED" ? "SCHEDULED" : "AWAITING", result: null, note: status === "SCHEDULED" ? `Booked at ${centre}.` : "Certificate uploaded." });
      }
      if (verificationDate) history.push({ at: verificationDate, by: nurse, role: "institution", status, result, note });

      out.push({
        id,
        accountId: a.id,
        studentName: a.studentName,
        registrationNo: a.registrationNo,
        applicationRef: a.applicationRef,
        institutionId: a.institutionId,
        programName: a.programName,
        requirementCode: code,
        status,
        result,
        verificationDate,
        centre,
        certificateRef,
        note,
        history,
      });
    });
  }
  return out;
}

let seedCache: MedicalRecord[] | null = null;
export function medicalSeed(): MedicalRecord[] {
  return (seedCache ??= seedMedical());
}

export const medicalStore = createCollection<MedicalRecord>("medical", medicalSeed);

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

export function clearanceFor(records: MedicalRecord[]): MedicalClearance {
  if (records.length === 0) return "IN_PROGRESS";
  if (records.some((r) => r.result === "UNFIT")) return "NOT_CLEARED";
  if (records.every((r) => r.status === "VERIFIED" && r.result && r.result !== "UNFIT")) return "CLEARED";
  return "IN_PROGRESS";
}

export function recordsByAccount(records: MedicalRecord[]): Map<string, MedicalRecord[]> {
  const m = new Map<string, MedicalRecord[]>();
  for (const r of records) {
    const list = m.get(r.accountId) ?? [];
    list.push(r);
    m.set(r.accountId, list);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Update (authorised users only)
// ---------------------------------------------------------------------------

export interface MedicalUpdate {
  status: MedicalStatus;
  result: MedicalResult | null;
  verificationDate: string | null;
  centre: string | null;
  certificateRef: string | null;
  note: string;
}

export function updateMedical(id: string, patch: MedicalUpdate, by: { name: string; role: Role }) {
  if (!canEditMedical(by.role)) return false;
  const rec = medicalStore.getAll().find((r) => r.id === id);
  if (!rec) return false;
  const event: MedicalEvent = {
    at: new Date().toISOString(),
    by: by.name,
    role: by.role === "AOSA_ADMIN" ? "admin" : "institution",
    status: patch.status,
    result: patch.result,
    note: patch.note.trim(),
  };
  medicalStore.update(id, { ...patch, note: patch.note.trim(), history: [...rec.history, event] });
  return true;
}
