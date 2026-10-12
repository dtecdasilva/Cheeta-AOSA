import type { ExaminationInput, ResultInput } from "./validation";

/**
 * An applicant's examinations and results as the APIs return them
 * (/api/student/examinations and /api/student/results), shared by the
 * server and the two forms.
 */

export interface SittingView {
  id: string;
  /** 1 for the first sitting, 2 for the second, ... */
  sittingNo: number;
  examinationYear: string;
  candidateNumber: string;
  centreNumber: string;
  /** How many results have been recorded against this sitting. */
  resultCount: number;
}

export interface ExaminationView extends Pick<ExaminationInput, "qualification"> {
  id: string;
  sittings: SittingView[];
  createdAt: string;
  updatedAt: string;
}

export interface ResultView extends ResultInput {
  id: string;
  /** The examination the sitting belongs to. Empty, with `sittingId`, on a result from before results were tied to an examination. */
  examinationId: string;
  /** The examination's qualification. */
  qualification: string;
  /** Worked out from the grade or score; null for a result recorded without one, or if the qualification no longer exists. */
  result: "Pass" | "Fail" | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * How an examination sitting is named wherever one is picked or listed:
 * "GCE Ordinary Level, 2023", with "(sitting 2 of 2)" added when the
 * examination was sat more than once.
 */
export function sittingLabel(qualification: string, sitting: Pick<SittingView, "sittingNo" | "examinationYear">, sittingsInExamination: number): string {
  return `${qualification}, ${sitting.examinationYear}${sittingsInExamination > 1 ? ` (sitting ${sitting.sittingNo} of ${sittingsInExamination})` : ""}`;
}
