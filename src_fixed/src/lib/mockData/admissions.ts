import { findApplicationsForInstitution } from "./applications";

export type AdmissionStatus = "OFFERED" | "ACCEPTED" | "REJECTED" | "PENDING";

export interface AdmissionRecord {
  id: string;
  institutionId: string;
  applicationId: string;
  applicantName: string;
  programId: string;
  choice: 1 | 2 | 3;
  status: AdmissionStatus;
  admissionDate: string | null;
}

const now = () => new Date().toISOString();
function genId(prefix = "adm") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// Build some mock admissions using existing mock applications if available.
const apps = findApplicationsForInstitution("inst-1");

export const mockAdmissions: AdmissionRecord[] = (
  apps.slice(0, 8).map((a, i) => ({
    id: genId(),
    institutionId: "inst-1",
    applicationId: a.id,
    applicantName: a.personalInfo ? `${a.personalInfo.firstName} ${a.personalInfo.lastName}` : "Unknown",
    programId: a.programChoices[0]?.programId ?? "PROGRAM-1",
    choice: (a.programChoices[0]?.rank as 1 | 2 | 3) ?? 1,
    status: i % 3 === 0 ? "ACCEPTED" : i % 3 === 1 ? "REJECTED" : "PENDING",
    admissionDate: i % 3 === 0 ? now() : null,
  })) as AdmissionRecord[]
).concat([
  {
    id: genId(),
    institutionId: "inst-1",
    applicationId: "app-1009",
    applicantName: "Test Applicant",
    programId: "PROGRAM-2",
    choice: 2,
    status: "OFFERED",
    admissionDate: now(),
  },
]);

export function findAdmissionsForInstitution(instId: string) {
  return mockAdmissions.filter((r) => r.institutionId === instId);
}

export function findAdmissionById(id: string) {
  return mockAdmissions.find((r) => r.id === id) ?? null;
}

export function findAdmissionByApplicationId(applicationId: string) {
  return mockAdmissions.find((r) => r.applicationId === applicationId) ?? null;
}

export function addAdmission(record: Omit<AdmissionRecord, "id">) {
  const newRec: AdmissionRecord = { id: genId(), ...record };
  mockAdmissions.push(newRec);
  return newRec;
}

export function updateAdmission(id: string, patch: Partial<AdmissionRecord>) {
  const idx = mockAdmissions.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  mockAdmissions[idx] = { ...mockAdmissions[idx], ...patch };
  return mockAdmissions[idx];
}
