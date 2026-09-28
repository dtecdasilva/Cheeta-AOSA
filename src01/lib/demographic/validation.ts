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

export type DemographicFieldErrors = Partial<Record<keyof Omit<DemographicProfile, "updatedAt">, string>>;

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
export function validateDemographicForSubmit(input: Partial<DemographicProfile>): DemographicFieldErrors {
  const errors = validateDemographicForSave(input);

  const requiredFields: (keyof Omit<DemographicProfile, "updatedAt">)[] = [
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

  for (const field of requiredFields) {
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
export function validateDemographicForSave(input: Partial<DemographicProfile>): DemographicFieldErrors {
  const errors: DemographicFieldErrors = {};

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

  if (input.countryOfBirth && !COUNTRIES.includes(input.countryOfBirth as (typeof COUNTRIES)[number])) {
    errors.countryOfBirth = "Select a valid option.";
  }
  if (input.countryOfResidence && !COUNTRIES.includes(input.countryOfResidence as (typeof COUNTRIES)[number])) {
    errors.countryOfResidence = "Select a valid option.";
  }
  if (input.nationality && !COUNTRIES.includes(input.nationality as (typeof COUNTRIES)[number])) {
    errors.nationality = "Select a valid option.";
  }
  if (input.parentsCountry && !COUNTRIES.includes(input.parentsCountry as (typeof COUNTRIES)[number])) {
    errors.parentsCountry = "Select a valid option.";
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
