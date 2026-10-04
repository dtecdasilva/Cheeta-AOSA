import { EducationRecordInput } from "./types";
import type { EducationLevelConfig } from "./configTypes";
import { COUNTRIES } from "@/lib/countries/data";

export type EducationFieldErrors = Partial<Record<keyof EducationRecordInput, string>>;

const MIN_YEAR = 1950;

function isBlank(value: string | undefined) {
  return !value || !value.trim();
}

function parseYear(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}

/**
 * Validates one education record against the configured school types and
 * qualifications (`levels`, the same list the API serves to the form), so
 * a school type or qualification the client couldn't have offered (stale
 * cache, tampered request) is rejected — the server never trusts the
 * client's copy of the config.
 */
export function validateEducationRecord(input: Partial<EducationRecordInput>, levels: EducationLevelConfig[]): EducationFieldErrors {
  const errors: EducationFieldErrors = {};
  const level = input.schoolType ? levels.find((l) => l.name === input.schoolType) : undefined;
  const currentYear = new Date().getFullYear();

  if (isBlank(input.schoolName)) {
    errors.schoolName = "School name is required.";
  }

  if (isBlank(input.country)) {
    errors.country = "Select the country the school is in.";
  } else if (!COUNTRIES.includes(input.country as (typeof COUNTRIES)[number])) {
    errors.country = "Select a valid country.";
  }

  if (isBlank(input.schoolType)) {
    errors.schoolType = "Select a school type.";
  } else if (!level) {
    errors.schoolType = "Select a valid school type.";
  }

  if (isBlank(input.qualification)) {
    errors.qualification = "Select a qualification.";
  } else if (!errors.schoolType && level && !level.qualifications.some((q) => q.label === input.qualification)) {
    errors.qualification = "Select a qualification that's valid for the chosen school type.";
  }

  const startYear = input.startYear ? parseYear(input.startYear) : null;
  const endYear = input.endYear ? parseYear(input.endYear) : null;

  if (isBlank(input.startYear)) {
    errors.startYear = "Start year is required.";
  } else if (startYear === null || startYear < MIN_YEAR || startYear > currentYear + 1) {
    errors.startYear = `Enter a valid year between ${MIN_YEAR} and ${currentYear + 1}.`;
  }

  if (isBlank(input.endYear)) {
    errors.endYear = "End year is required.";
  } else if (endYear === null || endYear < MIN_YEAR || endYear > currentYear + 1) {
    errors.endYear = `Enter a valid year between ${MIN_YEAR} and ${currentYear + 1}.`;
  }

  if (!errors.startYear && !errors.endYear && startYear !== null && endYear !== null) {
    if (endYear < startYear) {
      errors.endYear = "End year cannot be before start year.";
    } else if (endYear - startYear > 15) {
      errors.endYear = "That's an unusually long span for one school — check the years.";
    }
  }

  return errors;
}
