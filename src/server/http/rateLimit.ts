import "server-only";
import type { NextRequest } from "next/server";
import { TooManyRequestsError } from "./errors";

/**
 * Fixed-window rate limit for the unauthenticated endpoints that are worth
 * hammering (sign-in, registration, password reset).
 *
 * In-memory, so the limit is per server instance. That's a real but
 * partial protection; with several instances, move the counters to Redis
 * or the database behind this same function. Per-account lockout (in the
 * users table) is the stronger protection for sign-in and does work across
 * instances.
 */

const KEY = Symbol.for("cheeta-aosa.rate-limit");
const g = globalThis as unknown as { [KEY]?: Map<string, { count: number; resetAt: number }> };
const buckets = (g[KEY] ??= new Map());

/**
 * `subject` narrows the bucket to one account (an email address) on top of
 * the caller's address. Many people in Cameroon share one public address
 * (mobile networks, cybercafés, school labs), so a limit on the address
 * alone would lock out strangers who never did anything wrong.
 */
export function rateLimit(req: NextRequest, name: string, limit: number, windowMs: number, subject?: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = subject ? `${name}:${ip}:${subject.trim().toLowerCase()}` : `${name}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const minutes = Math.ceil((bucket.resetAt - now) / 60_000);
    throw new TooManyRequestsError(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

/**
 * Failure-only limit, for sign-in: `assertUnderFailureLimit` refuses once
 * `limit` failures have been noted for this address and account in the
 * window; `noteFailure` records one. Successful attempts are never counted.
 */
export function assertUnderFailureLimit(req: NextRequest, name: string, limit: number, subject: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const bucket = buckets.get(`${name}:${ip}:${subject.trim().toLowerCase()}`);
  const now = Date.now();
  if (bucket && bucket.resetAt > now && bucket.count >= limit) {
    const minutes = Math.ceil((bucket.resetAt - now) / 60_000);
    throw new TooManyRequestsError(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

export function noteFailure(req: NextRequest, name: string, windowMs: number, subject: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${name}:${ip}:${subject.trim().toLowerCase()}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else bucket.count += 1;
}
