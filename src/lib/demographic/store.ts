import "server-only";
import { DemographicProfile, EMPTY_DEMOGRAPHIC_PROFILE } from "./types";

/**
 * In-memory store standing in for the `demographic_profiles` table in
 * db/schema.sql, one row per applicant (user id -> profile). Follows the
 * same `globalThis`-keyed pattern as src/lib/auth/users.ts, for the same
 * reason: Next.js compiles Route Handlers and Server Components into
 * separate module graphs, and a plain module-level Map would silently
 * fork into two unsynced copies (this exact bug was hit and fixed for the
 * user store — see that file's comment for the full story). Keying off
 * `globalThis` guarantees one shared store across the whole process.
 *
 * Resets on server restart, same as every other in-memory store in this
 * codebase until a real database is introduced.
 */
const GLOBAL_KEY = Symbol.for("cheeta-aosa.student.demographicProfiles");

const globalStore = globalThis as unknown as { [GLOBAL_KEY]?: Map<string, DemographicProfile> };
if (!globalStore[GLOBAL_KEY]) {
  globalStore[GLOBAL_KEY] = new Map();
}
const profiles = globalStore[GLOBAL_KEY]!;

export function getDemographicProfile(userId: string): DemographicProfile | null {
  return profiles.get(userId) ?? null;
}

export function upsertDemographicProfile(
  userId: string,
  patch: Partial<Omit<DemographicProfile, "updatedAt">>
): DemographicProfile {
  const existing = profiles.get(userId);
  const merged: DemographicProfile = {
    ...EMPTY_DEMOGRAPHIC_PROFILE,
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  profiles.set(userId, merged);
  return merged;
}

/**
 * Loads a profile into this instance's in-memory cache exactly as given —
 * unlike upsertDemographicProfile, does NOT stamp a new updatedAt. Used
 * only to "warm" a same-process cache from the cross-instance cookie
 * fallback (see the route handler), where the data isn't new, just newly
 * visible to this particular instance.
 */
export function hydrateDemographicProfile(userId: string, profile: DemographicProfile): void {
  profiles.set(userId, profile);
}
