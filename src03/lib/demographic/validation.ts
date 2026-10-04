import { validateEmail, validateMobileNumber } from "@/lib/validation";
import {
  SEX_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  YES_NO_OPTIONS,
  RELIGION_OPTIONS,
  LANGUAGE_OPTIONS,
  CAMEROON_REGIONS,
  DIVISIONS_BY_REGION,
  COUNTRIES,
} from "./options";
import { DemographicProfile } from "./types";

export type DemographicField = keyof Omit<DemographicProfile, "updatedAt">;
export type DemographicFieldErrors = Partial<Record<DemographicField, string>>;

/** Fields that must be filled in before the section can be submitted. */
export const REQUIRED_DEMOGRAPHIC_FIELDS: readonly DemographicField[] = [
  "fullNameOnBirthCertificate",
  "dateOfBirth",
  "placeOfBirth",
  "countryOfBirth",
  "disability",
  "countryOfResidence",
  "nationality",
  "regionOfOrigin",
  "divisionOfOrigin",
  "townOfResidence",
  "religion",
  "maritalStatus",
  "sex",
  "fathersNames",
  "mothersNames",
  "preferredLanguage",
];

/**
 * The required fields for one particular record: the fixed list, plus the
 * disability description when the applicant has answered "Yes".
 */
export function requiredDemographicFields(input: Partial<DemographicProfile>): DemographicField[] {
  return input.disability === "Yes" ? [...REQUIRED_DEMOGRAPHIC_FIELDS, "disabilityDetails"] : [...REQUIRED_DEMOGRAPHIC_FIELDS];
}

/**
 * Which country names are accepted, per kind of field. The server passes
 * the countries currently offered (from the database, managed under
 * Admin → System → Countries). The forms pass `null`, which leaves the
 * country fields to the server: the picker only offers valid ones anyway.
 * Omitted, the built-in list is used.
 */
export interface DemographicValidationOptions {
  countries?: { all: readonly string[]; nationality: readonly string[]; residence: readonly string[] } | null;
}

/** Longest value accepted for each field; free-text fields get more room. */
const DEFAULT_MAX_LENGTH = 150;
const MAX_LENGTH: Partial<Record<DemographicField, number>> = {
  disabilityDetails: 500,
  parentsAddress: 300,
};
export function demographicMaxLength(field: DemographicField): number {
  return MAX_LENGTH[field] ?? DEFAULT_MAX_LENGTH;
}

const REQUIRED_MESSAGE = "This field is required.";

function isBlank(value: string | undefined) {
  return !value || !value.trim();
}

function isValidDateOfBirth(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (date > now) return false;
  const age = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return age >= 8 && age <= 100;
}

/**
 * Full validation, used for "Save & Continue" — every required field must
 * be present and every provided value must be in the right shape/list.
 */
export function validateDemographicForSubmit(input: Partial<DemographicProfile>, options: DemographicValidationOptions = {}): DemographicFieldErrors {
  const errors = validateDemographicForSave(input, options);

  for (const field of REQUIRED_DEMOGRAPHIC_FIELDS) {
    if (!errors[field] && isBlank(input[field])) {
      errors[field] = REQUIRED_MESSAGE;
    }
  }

  if (input.disability === "Yes" && isBlank(input.disabilityDetails)) {
    errors.disabilityDetails = "Describe the disability so institutions can accommodate it.";
  }

  return errors;
}

/**
 * Lighter validation, used for a plain "Save" — nothing is required yet
 * (the applicant can save partial progress), but anything that IS filled
 * in must be well-formed, so junk data never gets persisted even as a draft.
 */
export function validateDemographicForSave(input: Partial<DemographicProfile>, options: DemographicValidationOptions = {}): DemographicFieldErrors {
  const errors: DemographicFieldErrors = {};

  for (const [field, value] of Object.entries(input) as [DemographicField | "updatedAt", unknown][]) {
    if (field === "updatedAt" || typeof value !== "string") continue;
    const max = demographicMaxLength(field);
    if (value.length > max) errors[field] = `Keep this to ${max} characters or fewer.`;
  }

  if (input.dateOfBirth && !isValidDateOfBirth(input.dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  }

  if (input.sex && !SEX_OPTIONS.includes(input.sex as (typeof SEX_OPTIONS)[number])) {
    errors.sex = "Select a valid option.";
  }

  if (
    input.maritalStatus &&
    !MARITAL_STATUS_OPTIONS.includes(input.maritalStatus as (typeof MARITAL_STATUS_OPTIONS)[number])
  ) {
    errors.maritalStatus = "Select a valid option.";
  }

  if (input.disability && !YES_NO_OPTIONS.includes(input.disability as (typeof YES_NO_OPTIONS)[number])) {
    errors.disability = "Select a valid option.";
  }

  if (input.religion && !RELIGION_OPTIONS.includes(input.religion as (typeof RELIGION_OPTIONS)[number])) {
    errors.religion = "Select a valid option.";
  }

  if (
    input.preferredLanguage &&
    !LANGUAGE_OPTIONS.includes(input.preferredLanguage as (typeof LANGUAGE_OPTIONS)[number])
  ) {
    errors.preferredLanguage = "Select a valid option.";
  }

  if (options.countries !== null) {
    const lists = options.countries ?? { all: COUNTRIES, nationality: COUNTRIES, residence: COUNTRIES };
    const countryFields: [DemographicField, readonly string[]][] = [
      ["countryOfBirth", lists.all],
      ["countryOfResidence", lists.residence],
      ["nationality", lists.nationality],
      ["parentsCountry", lists.all],
    ];
    for (const [field, allowed] of countryFields) {
      const value = input[field];
      if (value && !errors[field] && !allowed.includes(value)) errors[field] = "Select a valid option.";
    }
  }

  if (input.regionOfOrigin && !CAMEROON_REGIONS.includes(input.regionOfOrigin as (typeof CAMEROON_REGIONS)[number])) {
    errors.regionOfOrigin = "Select a valid option.";
  }
  if (input.regionOfOrigin && input.divisionOfOrigin) {
    const validDivisions = DIVISIONS_BY_REGION[input.regionOfOrigin as (typeof CAMEROON_REGIONS)[number]] ?? [];
    if (!validDivisions.includes(input.divisionOfOrigin)) {
      errors.divisionOfOrigin = "Select a division that belongs to the chosen region.";
    }
  }

  if (input.disability === "Yes" && isBlank(input.disabilityDetails)) {
    // Only enforced at submit time, not draft-save time — see
    // validateDemographicForSubmit. Left unhandled here deliberately.
  }

  if (!isBlank(input.parentsTelephone)) {
    const check = validateMobileNumber(input.parentsTelephone!);
    if (!check.valid) errors.parentsTelephone = check.message;
  }

  if (!isBlank(input.parentsEmail)) {
    const check = validateEmail(input.parentsEmail!);
    if (!check.valid) errors.parentsEmail = check.message;
  }

  return errors;
}
