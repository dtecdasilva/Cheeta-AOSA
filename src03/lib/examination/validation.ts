import type { ExamConfiguration, ExamTypeConfig } from "./config";

/**
 * Rules for what applicants record on the Examinations and Results forms,
 * checked against the examination configuration. Used by the server on
 * every save; safe to use in the forms too.
 *
 * Errors are keyed by where they are, so a form can put each next to its
 * input: "qualification", "sittings", "sittings.0.examinationYear",
 * "sittings.1.subjectEntries.2.value".
 */

export interface SubjectEntryInput {
  subject: string;
  /** A grade label, or a score as text. */
  value: string;
}

export interface SittingInput {
  examinationYear: string;
  candidateNumber: string;
  centreNumber: string;
  subjectEntries: SubjectEntryInput[];
}

export interface ExaminationInput {
  /** Qualification id from the configuration ("GCE_OL", or a BAC/BEPC/Probatoire type id). */
  qualification: string;
  sittings: SittingInput[];
}

export interface ResultInput {
  qualification: string;
  subject: string;
  value: string;
  /** Set instead of `value` for a result recorded without a grade, e.g. Absent. */
  resultTypeId: string;
}

export type ExamFieldErrors = Record<string, string>;

export const MIN_EXAM_YEAR = 1970;
const MAX_NUMBER_LENGTH = 40;

export function isValidScore(raw: string, max: number): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) return false;
  const n = Number(raw);
  return n >= 0 && n <= max;
}

/** Null if the grade or score is acceptable for the qualification, otherwise why not. */
function valueProblem(config: ExamTypeConfig, value: string, keep?: string): string | null {
  if (!value.trim()) return config.resultMode === "grade" ? "Choose a grade." : "Enter a score.";
  if (value === keep) return null;
  if (config.resultMode === "grade") return config.grades.includes(value) ? null : "Choose one of the grades offered.";
  return isValidScore(value, config.maxScore) ? null : `Enter a score from 0 to ${config.maxScore}.`;
}

/**
 * Finds the qualification, or reports why it can't be used. A
 * qualification that has been switched off can still be kept on a record
 * that already uses it (`keepQualification`), but not chosen afresh.
 */
function qualificationFor(id: string, config: ExamConfiguration, keepQualification: string | undefined, errors: ExamFieldErrors): ExamTypeConfig | undefined {
  if (!id) {
    errors.qualification = "Choose a qualification.";
    return undefined;
  }
  const type = config.get(id);
  if (!type || (!type.active && id !== keepQualification)) {
    errors.qualification = "Choose one of the qualifications offered.";
    return undefined;
  }
  return type;
}

export function validateExamination(
  input: ExaminationInput,
  config: ExamConfiguration,
  /** The record as stored, when updating: its qualification, subjects and values stay acceptable even if the configuration has changed since. */
  existing?: ExaminationInput
): ExamFieldErrors {
  const errors: ExamFieldErrors = {};
  const type = qualificationFor(input.qualification, config, existing?.qualification, errors);
  if (!type) return errors;

  if (input.sittings.length === 0) errors.sittings = "Add at least one sitting.";
  else if (input.sittings.length > type.maxSittings) errors.sittings = `${type.qualification} allows at most ${type.maxSittings} sitting${type.maxSittings === 1 ? "" : "s"}.`;

  const sameType = existing?.qualification === input.qualification;
  const keptSubjects = new Set(sameType ? existing!.sittings.flatMap((s) => s.subjectEntries.map((e) => e.subject)) : []);
  const keptValues = new Set(sameType ? existing!.sittings.flatMap((s) => s.subjectEntries.map((e) => `${e.subject}\n${e.value}`)) : []);
  const thisYear = new Date().getFullYear();

  input.sittings.forEach((sitting, i) => {
    const at = `sittings.${i}`;
    if (!/^\d{4}$/.test(sitting.examinationYear) || Number(sitting.examinationYear) < MIN_EXAM_YEAR || Number(sitting.examinationYear) > thisYear) {
      errors[`${at}.examinationYear`] = `Enter a year from ${MIN_EXAM_YEAR} to ${thisYear}.`;
    }
    for (const field of ["candidateNumber", "centreNumber"] as const) {
      const label = field === "candidateNumber" ? "candidate number" : "centre number";
      if (!sitting[field].trim()) errors[`${at}.${field}`] = `Enter the ${label}.`;
      else if (sitting[field].length > MAX_NUMBER_LENGTH) errors[`${at}.${field}`] = `Keep the ${label} to ${MAX_NUMBER_LENGTH} characters or fewer.`;
    }

    const seen = new Set<string>();
    sitting.subjectEntries.forEach((entry, j) => {
      const entryAt = `${at}.subjectEntries.${j}`;
      if (!entry.subject) errors[`${entryAt}.subject`] = "Choose a subject.";
      else if (!type.subjects.includes(entry.subject) && !keptSubjects.has(entry.subject)) errors[`${entryAt}.subject`] = "Choose one of the subjects offered for this qualification.";
      else if (seen.has(entry.subject)) errors[`${entryAt}.subject`] = "This subject is already listed for this sitting.";
      seen.add(entry.subject);

      const keep = keptValues.has(`${entry.subject}\n${entry.value}`) ? entry.value : undefined;
      const problem = valueProblem(type, entry.value, keep);
      if (problem) errors[`${entryAt}.value`] = problem;
    });
  });

  return errors;
}

export function validateResult(input: ResultInput, config: ExamConfiguration, existing?: ResultInput): ExamFieldErrors {
  const errors: ExamFieldErrors = {};
  const type = qualificationFor(input.qualification, config, existing?.qualification, errors);
  if (!type) return errors;

  const sameType = existing?.qualification === input.qualification;
  if (!input.subject) errors.subject = "Choose a subject.";
  else if (!type.subjects.includes(input.subject) && !(sameType && existing!.subject === input.subject)) errors.subject = "Choose one of the subjects offered for this qualification.";

  if (input.resultTypeId) {
    // A result recorded without a grade: it has to be one of the "not graded" result types on offer.
    const offered = config.notGradedTypes.some((r) => r.id === input.resultTypeId) || (existing?.resultTypeId === input.resultTypeId && !!config.resultType(input.resultTypeId));
    if (!offered) errors.resultTypeId = "Choose one of the results offered.";
    if (input.value.trim()) errors.value = "Leave the grade empty when recording a result such as Absent.";
  } else {
    const keep = sameType && existing!.subject === input.subject ? existing!.value : undefined;
    const problem = valueProblem(type, input.value, keep);
    if (problem) errors.value = problem;
  }
  return errors;
}
