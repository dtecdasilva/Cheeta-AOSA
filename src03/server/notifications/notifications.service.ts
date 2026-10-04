import "server-only";
import { and, count, desc, eq, isNull, or, type SQL } from "drizzle-orm";
import type { NotificationCategory } from "@/lib/notifications/center";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { NotFoundError } from "@/server/http/errors";

/**
 * In-app notifications. Categories and audiences are the notification
 * centre's (src/lib/notifications/center.ts). A notification is either
 * for one person (`recipientUserId`) or for everyone in an audience —
 * all AOSA administrators, or all staff of one institution.
 *
 * Known limit: a broadcast has one read/archived state shared by everyone
 * in its audience. Per-person state for broadcasts needs a
 * notification_receipts(notification_id, user_id, read_at, archived_at)
 * table; add it when the notification centre is wired to this API.
 */

export interface NewNotification {
  audience: "student" | "institution" | "admin";
  recipientUserId?: string | null;
  institutionId?: string | null;
  category: NotificationCategory;
  title: string;
  summary: string;
  body?: string;
  important?: boolean;
  action?: { label: string; href: string };
  reference?: string;
}

/** Call inside the transaction that caused it, so the notice and the change land together. */
export async function notify(db: Executor, n: NewNotification) {
  await db.insert(notifications).values({
    id: newId("ntf"),
    audience: n.audience,
    recipientUserId: n.recipientUserId ?? null,
    institutionId: n.institutionId ?? null,
    category: n.category,
    title: n.title,
    summary: n.summary,
    body: n.body ?? n.summary,
    important: n.important ?? false,
    action: n.action ?? null,
    reference: n.reference ?? null,
  });
}

/** What a user can see: their own, plus their audience's broadcasts. */
function visibleTo(user: PublicUser): SQL {
  const own = eq(notifications.recipientUserId, user.id);
  if (user.role === "AOSA_ADMIN") return or(own, and(eq(notifications.audience, "admin"), isNull(notifications.recipientUserId)))!;
  if (user.institutionId) return or(own, and(eq(notifications.audience, "institution"), eq(notifications.institutionId, user.institutionId), isNull(notifications.recipientUserId)))!;
  return own;
}

export async function listNotifications(user: PublicUser, opts: { archived: boolean; page: number; pageSize: number }) {
  const db = getDb();
  const where = and(visibleTo(user), opts.archived ? undefined : isNull(notifications.archivedAt));
  const [rows, [{ total }], [{ unread }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(notifications).where(where),
    db.select({ unread: count() }).from(notifications).where(and(visibleTo(user), isNull(notifications.archivedAt), isNull(notifications.readAt))),
  ]);
  return { data: rows, meta: { page: opts.page, pageSize: opts.pageSize, total, unread } };
}

export async function markNotification(user: PublicUser, id: string, patch: { read?: boolean; archived?: boolean }) {
  const db = getDb();
  const [row] = await db
    .update(notifications)
    .set({
      ...(patch.read !== undefined ? { readAt: patch.read ? new Date() : null } : {}),
      ...(patch.archived !== undefined ? { archivedAt: patch.archived ? new Date() : null } : {}),
    })
    .where(and(eq(notifications.id, id), visibleTo(user)))
    .returning();
  if (!row) throw new NotFoundError("Notification");
  return row;
}
