import "server-only";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { getDb } from "@/server/db/client";
import { institutions, notificationDeliveries, users } from "@/server/db/schema";
import { pagination, parseQuery } from "@/server/http/validate";

/** The delivery records, for Cheeta administration: every message, where it went and how it went. */

const query = pagination.extend({
  status: z.enum(["QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED", "SKIPPED"]).optional(),
  channel: z.enum(["IN_APP", "EMAIL", "SMS"]).optional(),
  event: z.string().max(100).optional(),
  recipientUserId: z.string().max(100).optional(),
  notificationId: z.string().max(100).optional(),
  q: z.string().trim().max(100).optional(),
});

export async function listDeliveries(req: NextRequest) {
  const q = parseQuery(req, query);
  const like = (v: string) => `%${v.replace(/[%_\\]/g, "\\$&")}%`;
  const where = and(
    ...([
      q.status ? eq(notificationDeliveries.status, q.status) : undefined,
      q.channel ? eq(notificationDeliveries.channel, q.channel) : undefined,
      q.event ? eq(notificationDeliveries.event, q.event) : undefined,
      q.recipientUserId ? eq(notificationDeliveries.recipientUserId, q.recipientUserId) : undefined,
      q.notificationId ? eq(notificationDeliveries.notificationId, q.notificationId) : undefined,
      q.q ? or(ilike(notificationDeliveries.destination, like(q.q)), ilike(notificationDeliveries.subject, like(q.q)), ilike(users.fullName, like(q.q))) : undefined,
    ] as (SQL | undefined)[])
  );
  const db = getDb();
  const [rows, [{ total }], byStatus] = await Promise.all([
    db
      .select({ d: notificationDeliveries, recipient: users.fullName, institution: institutions.name })
      .from(notificationDeliveries)
      .leftJoin(users, eq(users.id, notificationDeliveries.recipientUserId))
      .leftJoin(institutions, eq(institutions.id, notificationDeliveries.institutionId))
      .where(where)
      .orderBy(desc(notificationDeliveries.at))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ total: count() }).from(notificationDeliveries).leftJoin(users, eq(users.id, notificationDeliveries.recipientUserId)).where(where),
    db.select({ status: notificationDeliveries.status, n: count() }).from(notificationDeliveries).groupBy(notificationDeliveries.status),
  ]);
  return {
    data: rows.map((r) => ({ ...r.d, recipient: r.recipient, institution: r.institution, retryable: r.d.status === "FAILED" && !r.d.body.includes("••••••") })),
    meta: { page: q.page, pageSize: q.pageSize, total },
    counts: Object.fromEntries(byStatus.map((b) => [b.status, Number(b.n)])),
  };
}
