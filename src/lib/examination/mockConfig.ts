/**
 * Mock configuration for the Examination Information form. This is
 * deliberately plain, client-importable data — no "server-only" import,
 * no API route, no store. A later module can replace this with data
 * fetched from a real, admin-configurable backend without changing the
 * shape components consume it in (ExamTypeConfig / EXAM_TYPE_CONFIGS).
 */

export type ResultMode = "grade" | "score20";

export interface ExamTypeConfig {
  /** Shown in the Qualification dropdown, exactly as specified. */
  qualification: string;
  resultMode: ResultMode;
  /** Only used when resultMode === "grade". */
  grades: string[];
  /** Only used when resultMode === "grade" — which grade labels count as
   * a Pass. Used by the Results Information page to compute Result
   * live in the UI (pure frontend logic on mock data — no backend). */
  passingGrades: string[];
  /** Only used when resultMode === "score20" — minimum score (out of 20)
   * that counts as a Pass. */
  passMark: number;
  /** Mock subject pool for this qualification. */
  subjects: string[];
  /** A sensible default/typical number of sittings for this qualification
   * — GCE levels are commonly sat across more than one year, national
   * exams like BEPC/Probatoire/BAC are normally a single sitting. Purely
   * a UI default; the applicant can still change it. */
  defaultSittings: number;
  maxSittings: number;
}

export const EXAM_TYPE_CONFIGS: ExamTypeConfig[] = [
  {
    qualification: "GCE Ordinary Level",
    resultMode: "grade",
    grades: ["A", "B", "C", "F"],
    passingGrades: ["A", "B", "C"],
    passMark: 0,
    subjects: [
      "English Language",
      "French",
      "Mathematics",
      "Biology",
      "Chemistry",
      "Physics",
      "Literature in English",
      "History",
      "Geography",
      "Economics",
      "Computer Science",
    ],
    defaultSittings: 1,
    maxSittings: 3,
  },
  {
    qualification: "GCE Advanced Level",
    resultMode: "grade",
    grades: ["A", "B", "C", "D", "E", "F"],
    passingGrades: ["A", "B", "C", "D", "E"],
    passMark: 0,
    subjects: [
      "English Literature",
      "Mathematics",
      "Further Mathematics",
      "Biology",
      "Chemistry",
      "Physics",
      "Economics",
      "Geography",
      "History",
      "Computer Science",
    ],
    defaultSittings: 1,
    maxSittings: 3,
  },
  {
    qualification: "BEPC",
    resultMode: "score20",
    grades: [],
    passingGrades: [],
    passMark: 10,
    subjects: [
      "French",
      "English",
      "Mathematics",
      "History-Geography-Citizenship",
      "Physics-Chemistry-Technology",
      "Life and Earth Sciences",
    ],
    defaultSittings: 1,
    maxSittings: 2,
  },
  {
    qualification: "Probatoire",
    resultMode: "score20",
    grades: [],
    passingGrades: [],
    passMark: 10,
    subjects: ["French", "English", "Mathematics", "Physics", "Chemistry", "Biology", "History", "Geography"],
    defaultSittings: 1,
    maxSittings: 2,
  },
  {
    qualification: "BAC",
    resultMode: "score20",
    grades: [],
    passingGrades: [],
    passMark: 10,
    subjects: [
      "French",
      "English",
      "Philosophy",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Biology",
      "History",
      "Geography",
    ],
    defaultSittings: 1,
    maxSittings: 2,
  },
];

export function getExamTypeConfig(qualification: string): ExamTypeConfig | undefined {
  return EXAM_TYPE_CONFIGS.find((c) => c.qualification === qualification);
}

/**
 * Computes Result from a raw grade label or numeric score, using the
 * qualification's configured pass criteria — the "dynamic subject/result
 * entry" behavior the Results Information page needs. Pure frontend
 * logic on mock data; not backend result processing.
 */
export function computeResult(config: ExamTypeConfig, rawValue: string): "Pass" | "Fail" {
  if (config.resultMode === "grade") {
    return config.passingGrades.includes(rawValue) ? "Pass" : "Fail";
  }
  const score = Number(rawValue);
  if (!Number.isFinite(score)) return "Fail";
  return score >= config.passMark ? "Pass" : "Fail";
}
