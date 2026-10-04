import type { DemographicProfile } from "./types";
import { requiredDemographicFields, validateDemographicForSubmit, type DemographicField } from "./validation";

/**
 * How far along the demographic section is, worked out from the stored
 * record itself rather than from a flag, so it can't drift from the data.
 *
 * - NOT_STARTED  nothing has been saved yet.
 * - IN_PROGRESS  something is saved, but a required field is missing or
 *                invalid, or the section hasn't been submitted
 *                ("Save & Continue") yet.
 * - COMPLETE     every required field is valid and the section has been
 *                submitted. This is what an application needs before it
 *                can be sent to an institution.
 *
 * Shared by the server (which reports it) and the form (which shows it).
 */
export type DemographicCompletionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export interface DemographicCompletion {
  status: DemographicCompletionStatus;
  /** Whether the applicant has submitted the section, and when. */
  submitted: boolean;
  submittedAt: string | null;
  requiredTotal: number;
  requiredCompleted: number;
  /** requiredCompleted as a whole percentage of requiredTotal. */
  percent: number;
  /** Required fields still empty. */
  missingFields: { field: DemographicField; label: string }[];
  /** Fields that have a value the rules reject, with the reason. */
  invalidFields: { field: DemographicField; label: string; message: string }[];
  /** Everything required is in and valid; only "Save & Continue" is left. */
  readyToSubmit: boolean;
}

/** What each field is called on the form. */
export const DEMOGRAPHIC_FIELD_LABELS: Record<DemographicField, string> = {
  fullNameOnBirthCertificate: "Full name as shown on birth certificate",
  dateOfBirth: "Date of birth",
  placeOfBirth: "Place of birth",
  countryOfBirth: "Country of birth",
  poBox: "P.O. Box",
  alternativeTelephone: "Alternative telephone",
  disability: "Disability",
  disabilityDetails: "Disability details",
  countryOfResidence: "Country of residence",
  nationality: "Nationality",
  regionOfOrigin: "Region of origin",
  divisionOfOrigin: "Division of origin",
  townOfResidence: "Town of residence",
  religion: "Religion",
  maritalStatus: "Marital status",
  sex: "Sex",
  fathersNames: "Father's names",
  mothersNames: "Mother's names",
  parentsCountry: "Parent's country",
  parentsTownCity: "Parent's town/city",
  parentsAddress: "Parent's address",
  parentsOccupation: "Parent's occupation",
  parentsTelephone: "Parent's telephone",
  parentsEmail: "Parent's email",
  preferredLanguage: "Preferred language / language of instruction",
};

const blank = (v: string | undefined) => !v || !v.trim();

export function demographicCompletion(profile: Partial<Record<DemographicField, string>> | null, submittedAt: string | null): DemographicCompletion {
  const record: Partial<DemographicProfile> = profile ?? {};
  const required = requiredDemographicFields(record);
  // Country names were checked against the list on offer when they were saved;
  // completion doesn't re-judge them against today's list.
  const errors = validateDemographicForSubmit(record, { countries: null });

  const missingFields = required.filter((f) => blank(record[f])).map((field) => ({ field, label: DEMOGRAPHIC_FIELD_LABELS[field] }));
  const invalidFields = (Object.keys(errors) as DemographicField[])
    .filter((f) => !blank(record[f]))
    .map((field) => ({ field, label: DEMOGRAPHIC_FIELD_LABELS[field], message: errors[field]! }));

  const requiredCompleted = required.filter((f) => !blank(record[f]) && !errors[f]).length;
  const started = profile !== null && (Object.keys(DEMOGRAPHIC_FIELD_LABELS) as DemographicField[]).some((f) => !blank(record[f]));
  const allValid = missingFields.length === 0 && invalidFields.length === 0;
  const submitted = submittedAt !== null;

  return {
    status: !started ? "NOT_STARTED" : allValid && submitted ? "COMPLETE" : "IN_PROGRESS",
    submitted,
    submittedAt,
    requiredTotal: required.length,
    requiredCompleted,
    percent: Math.round((requiredCompleted / required.length) * 100),
    missingFields,
    invalidFields,
    readyToSubmit: started && allValid && !submitted,
  };
}
