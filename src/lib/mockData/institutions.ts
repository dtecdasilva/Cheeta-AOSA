import { Application, Institution, ProgramChoice, StudyProgram, UploadedDocument, PaymentInfo } from "@/lib/types";

export const mockInstitutions: Institution[] = [
  {
    id: "inst-oxf",
    name: "Oxbridge International University",
    type: "University",
    location: "Oxford, UK",
    logoInitial: "O",
    applicationFee: 50,
    webFee: 5,
    maxProgramChoices: 3,
    requiredDocuments: ["Transcript", "Passport", "Certificates"],
  },
  {
    id: "inst-ken",
    name: "Kenvale Polytechnic",
    type: "Vocational School",
    location: "Nairobi, Kenya",
    logoInitial: "K",
    applicationFee: 30,
    webFee: 3,
    maxProgramChoices: 3,
    requiredDocuments: ["Transcript", "ID", "Passport"],
  },
];

export const mockPrograms: StudyProgram[] = [
  { id: "p-1", institutionId: "inst-oxf", faculty: "Faculty of Science", department: "Biological Sciences", name: "BSc Biology", qualification: "BSc" },
  { id: "p-2", institutionId: "inst-oxf", faculty: "Faculty of Engineering", department: "Computer Engineering", name: "BEng Computer Engineering", qualification: "BEng" },
  { id: "p-3", institutionId: "inst-ken", faculty: "School of Business", department: "Accounting", name: "Diploma in Accounting", qualification: "Dip" },
  { id: "p-4", institutionId: "inst-ken", faculty: "School of Applied Sciences", department: "Information Technology", name: "Certificate in IT", qualification: "Cert" },
];

export const mockProgramChoices: ProgramChoice[] = [
  { institutionId: "inst-oxf", programId: "p-2", rank: 1 },
  { institutionId: "inst-oxf", programId: "p-1", rank: 2 },
  { institutionId: "inst-ken", programId: "p-3", rank: 1 },
];

export const mockDocuments: UploadedDocument[] = [
  { id: "d-1", institutionId: "inst-oxf", requirementName: "Transcript", fileName: "transcript.pdf", uploadedAt: "2026-09-01T10:00:00Z" },
  { id: "d-2", institutionId: "inst-oxf", requirementName: "Passport", fileName: null, uploadedAt: null },
  { id: "d-3", institutionId: "inst-oxf", requirementName: "Certificates", fileName: "certs.zip", uploadedAt: "2026-09-02T12:00:00Z" },
  { id: "d-4", institutionId: "inst-ken", requirementName: "Transcript", fileName: "ken_transcript.pdf", uploadedAt: "2026-08-28T08:30:00Z" },
  { id: "d-5", institutionId: "inst-ken", requirementName: "ID", fileName: null, uploadedAt: null },
  { id: "d-6", institutionId: "inst-ken", requirementName: "Passport", fileName: "passport.jpg", uploadedAt: "2026-08-28T08:33:00Z" },
];

// Document review states (mock)
export type DocumentReviewState = "PENDING" | "APPROVED" | "REJECTED" | "NOT_UPLOADED";

export const mockDocumentStates: Record<string, { status: DocumentReviewState; rejectionReason?: string | null }> = {
  "d-1": { status: "APPROVED" },
  "d-2": { status: "NOT_UPLOADED" },
  "d-3": { status: "PENDING" },
  "d-4": { status: "APPROVED" },
  "d-5": { status: "REJECTED", rejectionReason: "ID mismatch" },
  "d-6": { status: "APPROVED" },
};

// Optional documents per institution (mock)
export const mockOptionalDocuments: Record<string, string[]> = {
  "inst-oxf": ["Birth certificate", "Passport-size photograph", "Other institution documents"],
  "inst-ken": ["Birth certificate", "Examination slips", "Passport-size photograph"],
};

export const mockPayments: Record<string, PaymentInfo | null> = {
  "inst-oxf": { method: "Card", reference: "PAY-0001", paidAt: "2026-09-03T09:00:00Z", amount: 55 },
  "inst-ken": null,
};

export const mockPerInstitutionStatus: Record<string, string> = {
  "inst-oxf": "SUBMITTED",
  "inst-ken": "INCOMPLETE",
};

export const mockApplication = (): Application => ({
  id: "app-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  overallStatus: "SUBMITTED",
  institutionIds: mockInstitutions.map((i) => i.id),
  perInstitutionStatus: mockPerInstitutionStatus as any,
  steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "editable", fees: "editable", review: "locked" },
  personalInfo: null,
  education: [],
  examinations: [],
  programChoices: mockProgramChoices,
  documents: mockDocuments,
  payment: null,
  submittedAt: new Date().toISOString(),
});
