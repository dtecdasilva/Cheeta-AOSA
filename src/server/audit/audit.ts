import "server-only";
import type { Executor } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { getRequestContext } from "@/server/logging/context";

/**
 * Appends to the audit trail. Call it inside the same transaction as the
 * change, so a change is never recorded without its audit row (or vice
 * versa). The actor, request id and IP come from the request context.
 */

const IGNORED = new Set(["updatedAt", "createdAt", "passwordHash"]);

function same(a: unknown, b: unknown) {
  if (a instanceof Date || b instanceof Date) return new Date(a as Date).getTime() === new Date(b as Date).getTime();
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The fields that differ between two versions of a record. */
export function diff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (IGNORED.has(k)) continue;
    const from = before?.[k];
    const to = after?.[k];
    if (!same(from, to)) out[k] = { from: from ?? null, to: to ?? null };
  }
  return out;
}

export async function audit(
  db: Executor,
  entry: {
    action: string;
    entityType: string;
    entityId?: string | null;
    institutionId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    meta?: Record<string, unknown>;
    /** For actions taken before there's a session (sign-in, registration). */
    actorUserId?: string;
  }
) {
  const ctx = getRequestContext();
  const changes = entry.before !== undefined || entry.after !== undefined ? diff(entry.before, entry.after) : null;
  if (entry.action === "update" && changes && Object.keys(changes).length === 0) return;
  await db.insert(auditLog).values({
    id: newId("aud"),
    actorUserId: entry.actorUserId ?? ctx?.userId ?? null,
    actorRole: ctx?.role ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    institutionId: entry.institutionId ?? ctx?.institutionId ?? null,
    changes,
    meta: entry.meta ?? null,
    requestId: ctx?.requestId ?? null,
    ip: ctx?.ip ?? null,
  });
}
