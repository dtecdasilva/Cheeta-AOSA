import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { PublicUser } from "@/lib/auth/users";
import { AUDIT_CATEGORIES, isAuditCategory } from "@/lib/audit/categories";
import { getDb } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { ForbiddenError, ValidationError } from "@/server/http/errors";
import { pagination, parseQuery } from "@/server/http/validate";

/**
 * Reading the audit trail. Cheeta administration reads all of it; an
 * institution administrator reads what happened at their institution.
 * Nothing here (or anywhere) changes an entry: the table is append-only.
 *
 *   ?category=   one or more, comma-separated (authentication, submission, ...)
 *   ?action= ?entityType= ?entityId= ?actorUserId= ?institutionId=
 *   ?q=          searches who, what and the record's id
 *   ?from= ?to=  dates (YYYY-MM-DD, inclusive, Cameroon time)
 *   ?dir=asc|desc (newest first by default) ?page= ?pageSize= ?format=csv
 */

const query = pagination.extend({
  category: z.string().max(400).optional(),
  action: z.string().max(60).optional(),
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(200).optional(),
  actorUserId: z.string().max(100).optional(),
  institutionId: z.string().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
  format: z.enum(["json", "csv"]).default("json"),
});

const dayStart = (d: string) => new Date(`${d}T00:00:00+01:00`);

function scope(user: PublicUser, requested?: string): string | null {
  if (user.role === "AOSA_ADMIN") return requested ?? null;
  if (user.role === "INSTITUTION_ADMIN" && user.institutionId) return user.institutionId;
  throw new ForbiddenError("The audit trail is for administrators.");
}

export async function listAudit(user: PublicUser, req: NextRequest) {
  const q = parseQuery(req, query);
  const institutionId = scope(user, q.institutionId);
  const categories = q.category ? q.category.split(",").map((c) => c.trim()).filter(Boolean) : [];
  const unknown = categories.filter((c) => !isAuditCategory(c));
  if (unknown.length) throw new ValidationError({ category: `Unknown category: ${unknown.join(", ")}. Use: ${Object.keys(AUDIT_CATEGORIES).join(", ")}.` });
  if (q.from && q.to && q.from > q.to) throw new ValidationError({ from: "The start of the range is after its end." });
  const like = q.q ? `%${q.q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const where = and(
    ...([
      institutionId ? eq(auditLog.institutionId, institutionId) : undefined,
      categories.length ? inArray(auditLog.category, categories) : undefined,
      q.action ? eq(auditLog.action, q.action) : undefined,
      q.entityType ? eq(auditLog.entityType, q.entityType) : undefined,
      q.entityId ? eq(auditLog.entityId, q.entityId) : undefined,
      q.actorUserId ? eq(auditLog.actorUserId, q.actorUserId) : undefined,
      q.from ? gte(auditLog.at, dayStart(q.from)) : undefined,
      q.to ? lt(auditLog.at, new Date(dayStart(q.to).getTime() + 86_400_000)) : undefined,
      like ? or(ilike(auditLog.actorLabel, like), ilike(auditLog.entityId, like), ilike(auditLog.action, like), ilike(auditLog.entityType, like)) : undefined,
    ] as (SQL | undefined)[])
  );
  const db = getDb();
  const order = q.dir === "asc" ? [asc(auditLog.at), asc(auditLog.id)] : [desc(auditLog.at), desc(auditLog.id)];

  if (q.format === "csv") {
    const rows = await db.select().from(auditLog).where(where).orderBy(...order).limit(50_000);
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const head = ["When", "Category", "Action", "Who", "Role", "Record type", "Record", "Institution", "Changes", "Details", "IP", "Request"];
    const lines = rows.map((r) => [r.at.toISOString(), AUDIT_CATEGORIES[r.category as keyof typeof AUDIT_CATEGORIES] ?? r.category, r.action, r.actorLabel ?? r.actorUserId ?? "", r.actorRole ?? "", r.entityType, r.entityId ?? "", r.institutionId ?? "", r.changes, r.meta, r.ip ?? "", r.requestId ?? ""].map(esc).join(","));
    return { csv: [head.join(","), ...lines].join("\n"), filename: `audit-${new Date().toISOString().slice(0, 10)}.csv` };
  }

  const [rows, [{ total }], byCategory] = await Promise.all([
    db.select().from(auditLog).where(where).orderBy(...order).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db.select({ total: count() }).from(auditLog).where(where),
    db.select({ category: auditLog.category, n: count() }).from(auditLog).where(institutionId ? eq(auditLog.institutionId, institutionId) : undefined).groupBy(auditLog.category),
  ]);
  return {
    data: rows.map((r) => ({ ...r, categoryLabel: AUDIT_CATEGORIES[r.category as keyof typeof AUDIT_CATEGORIES] ?? r.category })),
    meta: { page: q.page, pageSize: q.pageSize, total },
    categories: Object.entries(AUDIT_CATEGORIES).map(([key, label]) => ({ key, label, count: Number(byCategory.find((b) => b.category === key)?.n ?? 0) })),
  };
}
