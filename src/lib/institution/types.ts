/**
 * An institution's own records, as the institution API returns them
 * (/api/institution/faculties, /departments, /programs). The hierarchy is
 * Institution -> Faculty/School -> Department -> Qualification -> Study
 * program; each record carries the ids of the levels above it.
 */
export type RecordStatus = "ACTIVE" | "INACTIVE";

export interface Faculty {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  dean: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  regionId: string | null;
  townId: string | null;
  status: RecordStatus;
}

export interface Department {
  id: string;
  institutionId: string;
  facultyId: string;
  name: string;
  code: string;
  head: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  regionId: string | null;
  townId: string | null;
  status: RecordStatus;
}

export type StudyMode = "FULL_TIME" | "PART_TIME" | "DISTANCE";
export type TeachingLanguage = "EN" | "FR" | "BILINGUAL";

export interface Program {
  id: string;
  institutionId: string;
  facultyId: string;
  departmentId: string;
  code: string;
  name: string;
  /** Id of a qualification type (the platform's "qualification-types" list). */
  qualificationId: string;
  durationYears: number;
  studyMode: StudyMode;
  language: TeachingLanguage;
  availableSpaces: number;
  status: RecordStatus;
}

export const STUDY_MODE_LABELS: Record<StudyMode, string> = { FULL_TIME: "Full time", PART_TIME: "Part time", DISTANCE: "Distance learning" };
export const LANGUAGE_LABELS: Record<TeachingLanguage, string> = { EN: "English", FR: "French", BILINGUAL: "Bilingual" };
