import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { Role } from "@/lib/auth/roles";
import { SESSION_COOKIE } from "@/lib/auth/session";
import type { PublicUser } from "@/lib/auth/users";
import { resolveSession } from "@/server/auth/session";
import { runWithContext, setActor } from "@/server/logging/context";
import { logger, type Logger } from "@/server/logging/logger";
import { AppError, ForbiddenError, UnauthorizedError, ValidationError, fromDatabaseError } from "./errors";
import { toFieldErrors } from "./validate";

/**
 * Wraps every API route handler:
 *
 *   export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ user, params }) => { ... });
 *
 * - gives the request an id (honouring a sane incoming X-Request-Id) and
 *   returns it in the X-Request-Id header and in error bodies;
 * - resolves the session and enforces `auth`: "public", "authenticated",
 *   or a list of roles;
 * - refuses cross-site state-changing requests (Origin must match Host);
 * - logs one access line per request with status and duration;
 * - turns thrown errors into JSON: AppError subclasses keep their status,
 *   zod errors become 400 with fieldErrors, known Postgres constraint
 *   errors become 4xx, and anything else is a 500 that reveals nothing
 *   internal.
 */

type AuthSpec = "public" | "authenticated" | readonly Role[];

export interface HandlerContext<P, U> {
  req: NextRequest;
  params: P;
  user: U;
  requestId: string;
  log: Logger;
}

type RouteFn = (req: NextRequest, ctx: { params: Promise<Record<string, string | string[]>> }) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const access = logger.child({ module: "http" });

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Same-origin fetches from older browsers and server-to-server calls omit it.
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function errorResponse(err: unknown, requestId: string, log: Logger): NextResponse {
  let appErr: AppError | null = null;
  if (err instanceof AppError) appErr = err;
  else if (err instanceof ZodError) appErr = new ValidationError(toFieldErrors(err));
  else appErr = fromDatabaseError(err);

  if (appErr) {
    if (appErr.status >= 500) log.error(appErr.message, { err });
    return NextResponse.json({ error: appErr.message, code: appErr.code, requestId, ...appErr.extra }, { status: appErr.status });
  }

  log.error("Unhandled error", { err });
  return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "INTERNAL", requestId }, { status: 500 });
}

export function handler<P = Record<string, string>>(spec: { auth: "public" }, fn: (ctx: HandlerContext<P, PublicUser | null>) => Promise<Response>): RouteFn;
export function handler<P = Record<string, string>>(spec: { auth: "authenticated" | readonly Role[] }, fn: (ctx: HandlerContext<P, PublicUser>) => Promise<Response>): RouteFn;
export function handler<P>(
  spec: { auth: AuthSpec },
  fn: ((ctx: HandlerContext<P, PublicUser | null>) => Promise<Response>) | ((ctx: HandlerContext<P, PublicUser>) => Promise<Response>)
): RouteFn {
  return async (req, routeCtx) => {
    const incoming = req.headers.get("x-request-id");
    const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    const started = performance.now();
    const path = req.nextUrl.pathname;

    return runWithContext({ requestId, method: req.method, path, ip: clientIp(req) }, async () => {
      let res: NextResponse | Response;
      try {
        if (!SAFE_METHODS.has(req.method) && !sameOrigin(req)) throw new ForbiddenError("Cross-site request refused.");

        const user = await resolveSession(req.cookies.get(SESSION_COOKIE)?.value);
        if (user) setActor({ userId: user.id, role: user.role, institutionId: user.institutionId });
        if (spec.auth !== "public") {
          if (!user) throw new UnauthorizedError();
          if (spec.auth !== "authenticated" && !spec.auth.includes(user.role)) throw new ForbiddenError();
        }

        const params = (await routeCtx?.params) as P;
        // `user` is non-null here whenever auth isn't "public" (checked above), matching the overloads.
        res = await (fn as (ctx: HandlerContext<P, PublicUser | null>) => Promise<Response>)({ req, params, user, requestId, log: logger });
      } catch (err) {
        res = errorResponse(err, requestId, logger);
      }

      res.headers.set("X-Request-Id", requestId);
      res.headers.set("Cache-Control", res.headers.get("Cache-Control") ?? "no-store");
      const ms = Math.round(performance.now() - started);
      const line = { method: req.method, path, status: res.status, ms };
      if (res.status >= 500) access.error("request", line);
      else if (res.status >= 400) access.warn("request", line);
      else access.info("request", line);
      return res;
    });
  };
}
