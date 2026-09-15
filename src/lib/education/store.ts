import "server-only";
import { EducationRecord, EducationRecordInput } from "./types";
import { uid } from "@/lib/utils";

/**
 * In-memory store standing in for the `education_records` table in
 * db/schema.sql, one applicant to many records. Same `globalThis`-keyed
 * pattern as every other store in this codebase (see auth/users.ts for
 * why a plain module-level Map isn't safe across Next.js's Route
 * Handler / Server Component module graphs).
 */
const GLOBAL_KEY = Symbol.for("cheeta-aosa.student.educationRecords");

const globalStore = globalThis as unknown as { [GLOBAL_KEY]?: Map<string, EducationRecord[]> };
if (!globalStore[GLOBAL_KEY]) {
  globalStore[GLOBAL_KEY] = new Map();
}
const records = globalStore[GLOBAL_KEY]!;

export function listEducationRecords(userId: string): EducationRecord[] {
  return records.get(userId) ?? [];
}

export function createEducationRecord(userId: string, input: EducationRecordInput): EducationRecord {
  const now = new Date().toISOString();
  const record: EducationRecord = { id: uid("edu"), ...input, createdAt: now, updatedAt: now };
  const existing = records.get(userId) ?? [];
  records.set(userId, [...existing, record]);
  return record;
}

/** Returns null if no record with that id exists for that user — callers
 * must treat null as "not found / not yours" and respond 404, never
 * silently succeed or leak whether the id exists for someone else. */
export function updateEducationRecord(
  userId: string,
  recordId: string,
  patch: Partial<EducationRecordInput>
): EducationRecord | null {
  const existing = records.get(userId) ?? [];
  const idx = existing.findIndex((r) => r.id === recordId);
  if (idx === -1) return null;
  const updated: EducationRecord = { ...existing[idx], ...patch, updatedAt: new Date().toISOString() };
  const next = [...existing];
  next[idx] = updated;
  records.set(userId, next);
  return updated;
}

export function deleteEducationRecord(userId: string, recordId: string): boolean {
  const existing = records.get(userId) ?? [];
  const next = existing.filter((r) => r.id !== recordId);
  if (next.length === existing.length) return false;
  records.set(userId, next);
  return true;
}

/**
 * Loads a user's full record list into this instance's in-memory cache
 * exactly as given, overwriting whatever (if anything) was already there.
 * Used only to "warm" a same-process cache from the cross-instance cookie
 * fallback (see the route handlers) — the data isn't new, just newly
 * visible to this particular instance.
 */
export function hydrateEducationRecords(userId: string, userRecords: EducationRecord[]): void {
  records.set(userId, userRecords);
}
