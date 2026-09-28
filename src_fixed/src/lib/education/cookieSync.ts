import "server-only";
import { EducationRecord } from "./types";
import { listEducationRecords, hydrateEducationRecords } from "./store";
import { readSignedCookie, buildSignedCookieValue } from "@/lib/cookieStore";

/**
 * Same reasoning as ACCOUNTS_COOKIE (src/lib/auth/users.ts) and
 * DEMOGRAPHIC_COOKIE — on serverless hosting, education/store.ts's
 * in-memory Map only reliably reflects whichever instance handled a given
 * request. This cookie carries a userId -> records[] map with the browser.
 */
export const EDUCATION_COOKIE = "aosa_education";

type RecordsMap = Record<string, EducationRecord[]>;

/** Call at the top of every route in this domain, before reading or
 * mutating records: makes sure this instance's in-memory cache reflects
 * whatever the browser's cookie already knows, so a record saved against
 * a different instance doesn't appear to have vanished. */
export async function ensureHydrated(userId: string): Promise<EducationRecord[]> {
  const inMemory = listEducationRecords(userId);
  if (inMemory.length > 0) return inMemory;

  const cookieMap = (await readSignedCookie<RecordsMap>(EDUCATION_COOKIE)) ?? {};
  const fromCookie = cookieMap[userId] ?? [];
  if (fromCookie.length > 0) {
    hydrateEducationRecords(userId, fromCookie);
  }
  return fromCookie;
}

/** Call after any create/update/delete: builds the cookie value the route
 * must set on its response so the change travels with the browser. */
export async function buildUpdatedEducationCookie(userId: string): Promise<string> {
  const cookieMap = (await readSignedCookie<RecordsMap>(EDUCATION_COOKIE)) ?? {};
  cookieMap[userId] = listEducationRecords(userId);
  return buildSignedCookieValue(cookieMap);
}
