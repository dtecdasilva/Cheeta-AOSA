import type { ExamConfiguration, ExamTypeConfig } from "./config";

/**
 * Rules for what applicants record on the Examinations and Results forms,
 * checked against the examination configuration. Used by the server on
 * every save; safe to use in the forms too.
 *
 * An examination is created first (its qualification and sittings), and
 * results are then added to one of its sittings. So no subject appears in
 * an examination, and a result names the sitting it belongs to, never a
 * qualification of its own.
 *
 * Errors are keyed by where they are, so a form can put each next to its
 * input: "qualification", "sittings", "sittings.0.examinationYear",
 * "sittingId", "subject", "value".
 */

export interface SittingInput {
  examinationYear: string;
  candidateNumber: string;
  centreNumber: string;
}

export interface ExaminationInput {
  /** Qualification id from the configuration ("GCE_OL", or a BAC/BEPC/Probatoire type id). */
  qualification: string;
  sittings: SittingInput[];
}

export interface ResultInput {
  /** The sitting of one of the applicant's examinations that the result was obtained at. */
  sittingId: string;
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
  /** The record as stored, when updating: its qualification stays acceptable even if it has been switched off since. */
  existing?: Pick<ExaminationInput, "qualification">
): ExamFieldErrors {
  const errors: ExamFieldErrors = {};
  const type = qualificationFor(input.qualification, config, existing?.qualification, errors);
  if (!type) return errors;

  if (input.sittings.length === 0) errors.sittings = "Add at least one sitting.";
  else if (input.sittings.length > type.maxSittings) errors.sittings = `${type.qualification} allows at most ${type.maxSittings} sitting${type.maxSittings === 1 ? "" : "s"}.`;

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
  });

  return errors;
}

/**
 * Checks a result against the qualification of the examination it is
 * being added to (`type`, which the caller reads from the applicant's
 * stored examination, so it is never taken from the request).
 *
 * `existing` is the result as stored, when updating: the subject and
 * grade it already has stay acceptable on the same sitting even if the
 * configuration has changed since.
 */
export function validateResult(input: ResultInput, type: ExamTypeConfig, config: ExamConfiguration, existing?: ResultInput): ExamFieldErrors {
  const errors: ExamFieldErrors = {};
  const sameSitting = existing?.sittingId === input.sittingId;

  if (!input.subject) errors.subject = "Choose a subject.";
  else if (!type.subjects.includes(input.subject) && !(sameSitting && existing!.subject === input.subject)) errors.subject = "Choose one of the subjects offered for this examination.";

  if (input.resultTypeId) {
    // A result recorded without a grade: it has to be one of the "not graded" result types on offer.
    const offered = config.notGradedTypes.some((r) => r.id === input.resultTypeId) || (existing?.resultTypeId === input.resultTypeId && !!config.resultType(input.resultTypeId));
    if (!offered) errors.resultTypeId = "Choose one of the results offered.";
    if (input.value.trim()) errors.value = "Leave the grade empty when recording a result such as Absent.";
  } else {
    const keep = sameSitting && existing!.subject === input.subject ? existing!.value : undefined;
    const problem = valueProblem(type, input.value, keep);
    if (problem) errors.value = problem;
  }
  return errors;
}
