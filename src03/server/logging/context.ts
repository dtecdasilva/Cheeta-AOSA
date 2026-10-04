import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Role } from "@/lib/auth/roles";

/**
 * Per-request context, available anywhere below a route handler without
 * passing it through every call: the logger stamps the request id on each
 * line, and the audit log records who did what from it.
 */
export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  ip: string | null;
  userId?: string;
  role?: Role;
  institutionId?: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Called once the session is known, so later log lines and audit rows carry the actor. */
export function setActor(actor: Pick<RequestContext, "userId" | "role" | "institutionId">) {
  const ctx = storage.getStore();
  if (ctx) Object.assign(ctx, actor);
}
