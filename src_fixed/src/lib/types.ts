// Core domain types for the Student/Applicant portal.
// Statuses are kept exactly as specified — do not collapse into a generic "Pending".

export type ApplicationStatus =
  | "INCOMPLETE"
  | "COMPLETED"
  | "SUBMITTED"
  | "A_ACKNOWLEDGED" // acknowledged by applicant
  | "I_ACKNOWLEDGED" // acknowledged by institution
  | "A_REJECTED" // rejected by applicant (e.g. declines offer)
  | "I_REJECTED" // rejected by institution
  | "ACCEPTED"
  | "RESUBMITTED";

export type InstitutionType =
  | "Secondary School"
  | "High School"
  | "University"
  | "Vocational School"
  | "Professional School";

export type StepStatus = "locked" | "editable" | "submitted";

export interface StepState {
  key: StepKey;
  status: StepStatus;
}

export type StepKey =
  | "personal"
  | "education"
  | "examination"
  | "institutions"
  | "documents"
  | "fees"
  | "review";

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  location: string;
  logoInitial: string;
  applicationFee: number;
  webFee: number;
  maxProgramChoices: number; // usually 3
  requiredDocuments: string[];
}

export interface StudyProgram {
  id: string;
  institutionId: string;
  faculty: string;
  department: string;
  name: string;
  qualification: string;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  email: string;
  phone: string;
  region: string;
  city: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
}

export interface EducationRecord {
  id: string;
  institutionName: string;
  qualification: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  gradeOrGpa: string;
}

export interface ExaminationRecord {
  id: string;
  examName: string;
  examYear: string;
  centerNumber: string;
  resultsSummary: string;
}

export interface ProgramChoice {
  institutionId: string;
  programId: string;
  rank: 1 | 2 | 3;
}

export interface UploadedDocument {
  id: string;
  institutionId: string;
  requirementName: string;
  fileName: string | null;
  uploadedAt: string | null;
}

export interface PaymentInfo {
  method: string;
  reference: string;
  paidAt: string | null;
  amount: number;
}

export interface Application {
  id: string;
  createdAt: string;
  updatedAt: string;
  overallStatus: ApplicationStatus;
  institutionIds: string[];
  perInstitutionStatus: Record<string, ApplicationStatus>;
  steps: Record<StepKey, StepStatus>;
  personalInfo: PersonalInfo | null;
  education: EducationRecord[];
  examinations: ExaminationRecord[];
  programChoices: ProgramChoice[];
  documents: UploadedDocument[];
  payment: PaymentInfo | null;
  submittedAt: string | null;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  applicationId: string | null;
}

export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}
