import "server-only";
import { and, count, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { NotificationCategory } from "@/lib/notifications/center";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { institutions, notificationDeliveries, notificationReceipts, notifications } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { NotFoundError } from "@/server/http/errors";

/**
 * In-app notifications. Categories and audiences are the notification
 * centre's (src/lib/notifications/center.ts). A notification is either
 * for one person (`recipientUserId`) or for everyone in an audience —
 * all AOSA administrators, or all staff of one institution.
 *
 * Templated messages (and their email and SMS) are raised through the
 * engine (./engine.ts); `notify` is for notices with no template, such as
 * an alert to administration. Read and archived state of a broadcast is
 * kept per person (notification_receipts).
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

/** Read and archived state for this person: on the notification if it is theirs alone, on their receipt if it is a broadcast. */
const readAtExpr = sql<Date | null>`CASE WHEN ${notifications.recipientUserId} IS NULL THEN ${notificationReceipts.readAt} ELSE ${notifications.readAt} END`;
const archivedAtExpr = sql<Date | null>`CASE WHEN ${notifications.recipientUserId} IS NULL THEN ${notificationReceipts.archivedAt} ELSE ${notifications.archivedAt} END`;

function withReceipt(db: Executor, user: PublicUser) {
  return db
    .select({ n: notifications, readAt: readAtExpr, archivedAt: archivedAtExpr, institutionName: institutions.name })
    .from(notifications)
    .leftJoin(notificationReceipts, and(eq(notificationReceipts.notificationId, notifications.id), eq(notificationReceipts.userId, user.id)))
    .leftJoin(institutions, eq(institutions.id, notifications.institutionId));
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

/**
 * The person's notifications in the notification centre's shape: each
 * with how it was delivered (in-app, email, SMS) and its history.
 * ?archived=true includes archived ones, for the history page.
 */
export async function listNotifications(user: PublicUser, opts: { archived: boolean; page: number; pageSize: number }) {
  const db = getDb();
  const where = and(visibleTo(user), opts.archived ? undefined : sql`${archivedAtExpr} IS NULL`);
  const [rows, [{ total }], [{ unread }]] = await Promise.all([
    withReceipt(db, user)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ total: count() })
      .from(notifications)
      .leftJoin(notificationReceipts, and(eq(notificationReceipts.notificationId, notifications.id), eq(notificationReceipts.userId, user.id)))
      .where(where),
    db
      .select({ unread: count() })
      .from(notifications)
      .leftJoin(notificationReceipts, and(eq(notificationReceipts.notificationId, notifications.id), eq(notificationReceipts.userId, user.id)))
      .where(and(visibleTo(user), sql`${archivedAtExpr} IS NULL`, sql`${readAtExpr} IS NULL`)),
  ]);
  const ids = rows.map((r) => r.n.id);
  const deliveries = ids.length
    ? await db.select().from(notificationDeliveries).where(inArray(notificationDeliveries.notificationId, ids)).orderBy(notificationDeliveries.at)
    : [];
  const byNotification = new Map<string, typeof deliveries>();
  for (const d of deliveries) byNotification.set(d.notificationId!, [...(byNotification.get(d.notificationId!) ?? []), d]);

  const data = rows.map(({ n, readAt, archivedAt, institutionName }) => {
    const sent = (byNotification.get(n.id) ?? []).map((d) => ({
      channel: d.channel,
      to: d.destination,
      status: d.status === "SENDING" ? "QUEUED" : d.status,
      at: iso(d.sentAt ?? d.at)!,
      ...(d.detail ? { detail: d.detail } : {}),
    }));
    const history = [
      { kind: "CREATED", at: iso(n.createdAt)!, ...(n.templateCode ? { note: `From template ${n.templateCode}` } : {}) },
      ...sent.filter((d) => d.status === "DELIVERED" || d.status === "SENT" || d.status === "FAILED").map((d) => ({ kind: d.status === "FAILED" ? "FAILED" : "DELIVERED", at: d.at, channel: d.channel, ...(d.detail ? { note: d.detail } : {}) })),
      ...(readAt ? [{ kind: "READ", at: iso(readAt)! }] : []),
      ...(archivedAt ? [{ kind: "ARCHIVED", at: iso(archivedAt)! }] : []),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return {
      id: n.id,
      audience: n.audience,
      category: n.category,
      title: n.title,
      summary: n.summary,
      body: n.body,
      createdAt: iso(n.createdAt),
      readAt: iso(readAt),
      archivedAt: iso(archivedAt),
      important: n.important,
      ...(n.action ? { action: n.action } : {}),
      ...(n.reference ? { reference: n.reference } : {}),
      ...(institutionName && n.audience === "student" ? { institutionName } : {}),
      ...(n.templateCode ? { templateCode: n.templateCode } : {}),
      deliveries: sent,
      history,
    };
  });
  return { data, meta: { page: opts.page, pageSize: opts.pageSize, total, unread } };
}

async function setState(db: Executor, user: PublicUser, ids: string[], patch: { read?: boolean; archived?: boolean }) {
  const visible = await db.select({ id: notifications.id, own: notifications.recipientUserId }).from(notifications).where(and(inArray(notifications.id, ids), visibleTo(user)));
  const now = new Date();
  const values = {
    ...(patch.read !== undefined ? { readAt: patch.read ? now : null } : {}),
    // Archiving something counts as having read it.
    ...(patch.archived !== undefined ? { archivedAt: patch.archived ? now : null } : {}),
  };
  const own = visible.filter((v) => v.own).map((v) => v.id);
  const shared = visible.filter((v) => !v.own).map((v) => v.id);
  if (own.length) {
    await db.update(notifications).set(values).where(inArray(notifications.id, own));
    if (patch.archived) await db.update(notifications).set({ readAt: now }).where(and(inArray(notifications.id, own), isNull(notifications.readAt)));
  }
  for (const id of shared) {
    await db
      .insert(notificationReceipts)
      .values({ notificationId: id, userId: user.id, readAt: patch.archived ? now : values.readAt ?? null, archivedAt: values.archivedAt ?? null })
      .onConflictDoUpdate({ target: [notificationReceipts.notificationId, notificationReceipts.userId], set: values });
    if (patch.archived) await db.update(notificationReceipts).set({ readAt: now }).where(and(eq(notificationReceipts.notificationId, id), eq(notificationReceipts.userId, user.id), isNull(notificationReceipts.readAt)));
  }
  return visible.length;
}

export async function markNotification(user: PublicUser, id: string, patch: { read?: boolean; archived?: boolean }) {
  const db = getDb();
  if (!(await setState(db, user, [id], patch))) throw new NotFoundError("Notification");
  const [row] = await withReceipt(db, user).where(eq(notifications.id, id)).limit(1);
  return { ...row.n, readAt: row.readAt, archivedAt: row.archivedAt };
}

/** Marks everything in the person's inbox read. */
export async function markAllRead(user: PublicUser) {
  const db = getDb();
  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .leftJoin(notificationReceipts, and(eq(notificationReceipts.notificationId, notifications.id), eq(notificationReceipts.userId, user.id)))
    .where(and(visibleTo(user), sql`${readAtExpr} IS NULL`))
    .limit(1000);
  if (unread.length) await setState(db, user, unread.map((u) => u.id), { read: true });
  return { marked: unread.length };
}
