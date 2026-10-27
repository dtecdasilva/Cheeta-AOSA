import type { AdmissionStatus, AdmissionType, ConditionStatus } from "./letter";

/** One row of the institution's Admission List, as /api/institution/admissions sends it. */
export interface AdmissionListItem {
  id: string;
  admissionNumber: string;
  status: AdmissionStatus;
  type: AdmissionType;
  /** Set on an admission that was made provisional: its conditions, deadline and where they stand. */
  provisional: { conditions: string; deadline: string | null; status: ConditionStatus; decidedAt: string | null; note: string | null } | null;
  admissionDate: string;
  respondedAt: string | null;
  institution: { id: string; name: string };
  program: { id: string; name: string; code: string; faculty: string; department: string };
  choice: number;
  application: { id: string; applicationNumber: string; status: string };
  applicant: { name: string; email: string };
  letter: { issuedAt: string | null; pdfUrl: string };
  deliberation: { runId: string; runNumber: number | null; resultId: string | null; reason: string | null } | null;
}
