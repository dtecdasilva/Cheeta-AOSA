import { InstitutionType } from "./types";
import { INSTITUTION_TYPES } from "./data";

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): ValidationResult {
  const email = value.trim();
  if (!email) return { valid: false, message: "Email address is required." };
  if (!EMAIL_PATTERN.test(email)) return { valid: false, message: "Enter a valid email address." };
  return { valid: true };
}

/**
 * Accepts international format (+237 670 00 00 00) or plain local digits,
 * stripped of spaces, dashes and parentheses before checking length.
 * Deliberately permissive on formatting since applicants will type this
 * in whatever style they're used to — the SMS gateway integration (not
 * built yet) is the right place to normalize to E.164, not this form.
 */
export function validateMobileNumber(value: string): ValidationResult {
  const raw = value.trim();
  if (!raw) return { valid: false, message: "Mobile telephone number is required." };
  const digitsOnly = raw.replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(digitsOnly)) {
    return { valid: false, message: "Enter a valid mobile number (8–15 digits, optional leading +)." };
  }
  return { valid: true };
}

export function normalizeMobileNumber(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

export function validateInstitutionType(value: string): ValidationResult {
  if (!value) return { valid: false, message: "Select an institution type." };
  if (!INSTITUTION_TYPES.includes(value as InstitutionType)) {
    return { valid: false, message: "Select a valid institution type." };
  }
  return { valid: true };
}
