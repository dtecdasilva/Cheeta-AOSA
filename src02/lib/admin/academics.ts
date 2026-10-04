import { createCollection } from "./store";
import { paramId, type ParamStatus } from "./parameters";
import { mockFaculties } from "@/lib/mockData/faculties";
import { mockDepartments } from "@/lib/mockData/departments";
import { mockPrograms } from "@/lib/mockData/programs";

/**
 * Faculties, departments and study programs across every institution, as
 * the Administration portal manages them.
 *
 * Seeded from the institution portal's mock data (src/lib/mockData) so
 * both portals start from the same records and ids. Each record points at
 * its parent by id (program → department → faculty → institution), which
 * is the shape the db tables will take.
 */

export interface AdminFaculty {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  dean: string;
  email: string;
  phone: string;
  address: string;
  status: ParamStatus;
  updatedAt: string;
}

export interface AdminDepartment {
  id: string;
  institutionId: string;
  facultyId: string;
  name: string;
  code: string;
  head: string;
  email: string;
  phone: string;
  status: ParamStatus;
  updatedAt: string;
}

export type StudyMode = "FULL_TIME" | "PART_TIME" | "DISTANCE";
export type TeachingLanguage = "EN" | "FR" | "BILINGUAL";

export interface AdminProgram {
  id: string;
  institutionId: string;
  facultyId: string;
  departmentId: string;
  code: string;
  name: string;
  /** Parameter id in the "qualification-types" list. */
  qualificationId: string;
  durationYears: number;
  studyMode: StudyMode;
  language: TeachingLanguage;
  availableSpaces: number;
  status: ParamStatus;
  updatedAt: string;
}

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  DISTANCE: "Distance learning",
};

export const LANGUAGE_LABELS: Record<TeachingLanguage, string> = {
  EN: "English",
  FR: "French",
  BILINGUAL: "Bilingual",
};

const SEEDED_AT = "2026-01-10T09:00:00.000Z";
const toStatus = (s: "active" | "inactive"): ParamStatus => (s === "active" ? "ACTIVE" : "INACTIVE");
const initials = (name: string) =>
  name
    .replace(/^(Faculty|School|Department|Institute) of /i, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);

export const facultyStore = createCollection<AdminFaculty>("faculties", () =>
  mockFaculties.map((f) => ({
    id: f.id,
    institutionId: f.institutionId,
    name: f.name,
    code: initials(f.name),
    dean: f.dean,
    email: f.email ?? "",
    phone: f.phone ?? "",
    address: f.address ?? "",
    status: toStatus(f.status),
    updatedAt: SEEDED_AT,
  }))
);

export const departmentStore = createCollection<AdminDepartment>("departments", () =>
  mockDepartments.map((d) => ({
    id: d.id,
    institutionId: d.institutionId,
    facultyId: d.facultyId ?? "",
    name: d.name,
    code: initials(d.name),
    head: d.head,
    email: d.email ?? "",
    phone: d.phone ?? "",
    status: toStatus(d.status),
    updatedAt: SEEDED_AT,
  }))
);

/** The institution portal's qualification ids, mapped onto the parameter list. */
const QUALIFICATION_CODES: Record<string, string> = { "q-bsc": "BSC", "q-msc": "MSC", "q-bcom": "BCOM", "q-hnd": "HND" };

export const programStore = createCollection<AdminProgram>("programs", () =>
  mockPrograms.map((p) => {
    const qual = QUALIFICATION_CODES[p.qualificationId ?? ""] ?? "BSC";
    return {
      id: p.id,
      institutionId: p.institutionId,
      facultyId: p.facultyId ?? "",
      departmentId: p.departmentId ?? "",
      code: p.code,
      name: p.name,
      qualificationId: paramId("qualification-types", qual),
      durationYears: qual === "HND" ? 2 : 3,
      studyMode: "FULL_TIME" as const,
      language: p.institutionId === "inst-2" ? ("FR" as const) : ("BILINGUAL" as const),
      availableSpaces: p.availableSpaces ?? 0,
      status: toStatus(p.status),
      updatedAt: SEEDED_AT,
    };
  })
);
