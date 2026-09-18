import { ApplicationStatus } from "@/lib/types";

export interface StatusEntry {
  status: ApplicationStatus;
  actor: "applicant" | "institution" | "system";
  note?: string;
  at: string; // ISO
}

export const mockStatusHistory: StatusEntry[] = [
  { status: "INCOMPLETE", actor: "applicant", note: "Started application", at: "2026-08-25T09:00:00Z" },
  { status: "COMPLETED", actor: "applicant", note: "Completed personal and education sections", at: "2026-08-28T14:12:00Z" },
  { status: "SUBMITTED", actor: "applicant", note: "Submitted application to institutions", at: "2026-09-01T10:05:00Z" },
  { status: "I_ACKNOWLEDGED", actor: "institution", note: "Institution acknowledged receipt", at: "2026-09-03T09:30:00Z" },
  { status: "RESUBMITTED", actor: "applicant", note: "Resubmitted after updating documents", at: "2026-09-08T11:22:00Z" },
  { status: "A_REJECTED", actor: "applicant", note: "Applicant declined provisional offer", at: "2026-09-12T08:05:00Z" },
];

export const mockRejectionReason = "Insufficient grades in prerequisite subjects.";

export const mockAdmissionInfo = {
  institutionId: "inst-oxf",
  offer: {
    offeredAt: "2026-09-02T13:00:00Z",
    decisionBy: "Oxbridge Admissions Office",
    details: "Provisional offer for BEng Computer Engineering. Subject to final transcript verification.",
  },
};
