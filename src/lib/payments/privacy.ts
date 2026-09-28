/**
 * What an institution is allowed to see about a student's payments.
 *
 * The rules (from the product owner):
 *
 * 1. Institutions never see the platform's web fee. They only ever see
 *    their own application fee or tuition.
 * 2. When a student has paid but AOSA hasn't confirmed it yet, the
 *    institution sees one line: the student's first name, surname
 *    initial and "awaiting payment". No amount, method, reference,
 *    contact details or program.
 * 3. AOSA administration is the only party that reviews the payment
 *    itself (amount, reference, receipt) and approves it.
 * 4. Approval issues a bank code. From then on the institution can
 *    identify the paid student by that code, and sees the full record.
 *
 * This file is the single place those rules are expressed in the
 * frontend. It is presentation-level only: the backend must enforce the
 * same redaction, because anything shipped to the browser can be read.
 */

import { seededRandom } from "@/lib/admin/store";

/** "Aïssatou Mballa" → "Aïssatou M." */
export function maskName(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${firstName.trim()} ${initial}.` : firstName.trim();
}

/** Splits a stored full name for masking. The last word is the surname. */
export function maskFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "Student";
  return maskName(parts.slice(0, -1).join(" "), parts[parts.length - 1]);
}

// ---------------------------------------------------------------------------
// Bank codes
// ---------------------------------------------------------------------------

/** No 0/O, 1/I, 2/Z, 5/S, 8/B: the code gets read aloud and typed from paper. */
const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";

function block(next: () => number, n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(next() * ALPHABET.length)];
  return s;
}

/**
 * A bank code identifies one approved payment, e.g. "BK26-7KQ3-M9TX".
 * `kind` is the second-to-last letter group's prefix so staff can tell an
 * application fee (A) from tuition (T) at a glance.
 */
export function makeBankCode(kind: "A" | "T", year: number, next: () => number = Math.random): string {
  return `BK${String(year).slice(2)}-${kind}${block(next, 3)}-${block(next, 4)}`;
}

/** Deterministic code for seed data (seeds must match on server and client). */
export function seedBankCode(kind: "A" | "T", year: number, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return makeBankCode(kind, year, seededRandom(h >>> 0));
}

/** Normalises what someone typed into a bank code lookup. */
export function normalizeBankCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 12) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export const BANK_CODE_HINT = "Format BK26-A7KQ-M9TX. Issued by AOSA when it approves a payment.";
