import { Application, ApplicationStatus, ProgramChoice, StudyProgram, UploadedDocument, PaymentInfo } from "@/lib/types";
import { institutions } from "@/lib/data";

/**
 * The institutions shown in the applicant-facing mock screens are the SAME
 * records the rest of the platform uses (src/lib/data.ts) rather than a
 * second, parallel list. Keeping one source of truth is what makes the
 * institution portal, the fee summary and the applicant screens agree on
 * ids, names, fees and currency — an earlier divergent copy here used
 * different ids (and GBP/KES amounts), which silently emptied every
 * institution-portal list and mispriced the summary cards.
 */
export const mockInstitutions = institutions;

/** The two institutions these applicant-facing mocks are written against. */
const INST_A = "inst-1";
const INST_B = "inst-2";

export const mockPrograms: StudyProgram[] = [
  { id: "p-1", institutionId: INST_A, faculty: "Faculty of Science", department: "Biology", name: "BSc Biology", qualification: "Bachelor's Degree" },
  { id: "p-2", institutionId: INST_A, faculty: "Faculty of Science", department: "Computer Science", name: "BSc Computer Science", qualification: "Bachelor's Degree" },
  { id: "p-3", institutionId: INST_B, faculty: "School of Engineering", department: "Electrical Systems", name: "HND Electrical Engineering", qualification: "Higher National Diploma" },
  { id: "p-4", institutionId: INST_B, faculty: "School of Engineering", department: "Civil Works", name: "HND Civil Engineering", qualification: "Higher National Diploma" },
];

export const mockProgramChoices: ProgramChoice[] = [
  { institutionId: INST_A, programId: "p-2", rank: 1 },
  { institutionId: INST_A, programId: "p-1", rank: 2 },
  { institutionId: INST_B, programId: "p-3", rank: 1 },
];

export const mockDocuments: UploadedDocument[] = [
  { id: "d-1", institutionId: INST_A, requirementName: "Birth certificate", fileName: "birth-certificate.pdf", uploadedAt: "2026-09-01T10:00:00Z" },
  { id: "d-2", institutionId: INST_A, requirementName: "Baccalaureate certificate", fileName: null, uploadedAt: null },
  { id: "d-3", institutionId: INST_A, requirementName: "Passport photo", fileName: "passport-photo.jpg", uploadedAt: "2026-09-02T12:00:00Z" },
  { id: "d-4", institutionId: INST_A, requirementName: "Transcript of records", fileName: "transcript.pdf", uploadedAt: "2026-09-02T12:05:00Z" },
  { id: "d-5", institutionId: INST_B, requirementName: "Birth certificate", fileName: "birth-certificate.pdf", uploadedAt: "2026-08-28T08:30:00Z" },
  { id: "d-6", institutionId: INST_B, requirementName: "Level certificate", fileName: null, uploadedAt: null },
  { id: "d-7", institutionId: INST_B, requirementName: "Passport photo", fileName: "passport-photo.jpg", uploadedAt: "2026-08-28T08:33:00Z" },
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
  [INST_A]: ["Recommendation letter", "Proof of residence"],
  [INST_B]: ["Examination slips", "Proof of residence"],
};

export const mockPayments: Record<string, PaymentInfo | null> = {
  // Amount is the institution's application fee + web fee, in XAF — the
  // currency every fee in this platform is stored in (see lib/utils.ts).
  [INST_A]: { method: "Mobile money", reference: "PAY-0001", paidAt: "2026-09-03T09:00:00Z", amount: 17500 },
  [INST_B]: null,
};

export const mockPerInstitutionStatus: Record<string, ApplicationStatus> = {
  [INST_A]: "SUBMITTED",
  [INST_B]: "INCOMPLETE",
};

export const mockApplication = (): Application => ({
  id: "app-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  overallStatus: "SUBMITTED",
  institutionIds: [INST_A, INST_B],
  perInstitutionStatus: mockPerInstitutionStatus,
  steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "editable", fees: "editable", review: "locked" },
  personalInfo: null,
  education: [],
  examinations: [],
  programChoices: mockProgramChoices,
  documents: mockDocuments,
  payment: null,
  submittedAt: new Date().toISOString(),
});
