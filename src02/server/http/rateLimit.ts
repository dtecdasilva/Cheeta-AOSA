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

export function rateLimit(req: NextRequest, name: string, limit: number, windowMs: number) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${name}:${ip}`;
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
