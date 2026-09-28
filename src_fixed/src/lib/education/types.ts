export interface EducationRecord {
  id: string;
  startYear: string;
  endYear: string;
  schoolName: string;
  schoolType: string; // must match an EducationLevelConfig.name
  qualification: string; // must be valid for that schoolType
  country: string; // the country the school is/was located in
  createdAt: string;
  updatedAt: string;
}

export type EducationRecordInput = Omit<EducationRecord, "id" | "createdAt" | "updatedAt">;
