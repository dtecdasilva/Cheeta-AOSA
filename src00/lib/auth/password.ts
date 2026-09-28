import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing — Node-only (`node:crypto`). Only ever imported from
 * Route Handlers and Server Components (Node runtime): user login,
 * password reset, and the mock user directory. Never import this from
 * middleware.ts or anything it pulls in — the Edge runtime doesn't have
 * `node:crypto`, and bundling it there breaks the build.
 *
 * scrypt is a memory-hard KDF built into Node's standard library, so this
 * needs no extra native dependency (unlike bcrypt). Each password gets its
 * own random salt; the stored form is `salt:hash`, both hex-encoded.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, 64);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * A one-time temporary login credential issued on registration, sent to
 * the applicant by email, and hashed with the same scryptSync used for
 * ordinary passwords before being stored — it's never kept in plaintext
 * anywhere past the moment it's generated and handed to the notification
 * layer. Formatted in two dash-separated groups (e.g. "K7H2-9F3D") so it's
 * easy to read back from an email and type in manually. Built from
 * `node:crypto`'s CSPRNG (`randomInt`), excluding visually ambiguous
 * characters (0/O, 1/I/L) to cut down on transcription errors.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTemporaryCode(): string {
  const group = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `${group()}-${group()}`;
}
