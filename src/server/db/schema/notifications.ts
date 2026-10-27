import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, recordStatus, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { institutions } from "./institutions";

/**
 * In-app notifications, their delivery by email/SMS, and the templates
 * they're written from (src/lib/notifications/center.ts,
 * src/lib/admin/templates.ts).
 */

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: id(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    channel: text("channel", { enum: ["IN_APP", "EMAIL", "SMS"] }).notNull(),
    /** Event key from the frontend's TEMPLATE_EVENTS, e.g. "application.submitted". */
    event: text("event").notNull(),
    /** The language of the wording; a person gets the template in their own language when there is an active one, else the English. */
    language: text("language", { enum: ["en", "fr"] }).notNull().default("en"),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull(),
    status: recordStatus(),
    version: integer("version").notNull().default(1),
    notes: text("notes").notNull().default(""),
    updatedBy: text("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("notification_templates_code_unique").on(t.code)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    /** The person it's for. Null for an institution-wide or admin-wide notice. */
    recipientUserId: text("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    audience: text("audience", { enum: ["student", "institution", "admin"] }).notNull(),
    institutionId: text("institution_id").references(() => institutions.id),
    category: text("category").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    important: boolean("important").notNull().default(false),
    action: jsonb("action").$type<{ label: string; href: string }>(),
    reference: text("reference"),
    templateCode: text("template_code"),
    readAt: ts("read_at"),
    archivedAt: ts("archived_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientUserId, t.createdAt),
    index("notifications_audience_idx").on(t.audience, t.institutionId, t.createdAt),
  ]
);

/**
 * Every message the platform sends or shows, one row per channel and
 * recipient: what it was (event, template and version, the rendered
 * subject and body), where it went, through which provider, and how it
 * went. Email and SMS rows are written QUEUED in the transaction that
 * caused them and sent after it commits (the outbox), so a change that is
 * rolled back never sends anything. Messages carrying a login code or a
 * reset link are sent at once and stored with those values masked.
 */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: id(),
    /** The in-app notification this message goes with, if there is one. */
    notificationId: text("notification_id").references(() => notifications.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    institutionId: text("institution_id").references(() => institutions.id),
    /** Event key, e.g. "application.submitted". */
    event: text("event"),
    templateId: text("template_id").references(() => notificationTemplates.id, { onDelete: "set null" }),
    templateCode: text("template_code"),
    templateVersion: integer("template_version"),
    channel: text("channel", { enum: ["IN_APP", "EMAIL", "SMS"] }).notNull(),
    destination: text("destination").notNull(),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    /** QUEUED → SENDING → SENT (or DELIVERED for in-app); FAILED after the last attempt; SKIPPED when the channel is switched off or there's no address. */
    status: text("status", { enum: ["QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED", "SKIPPED"] }).notNull(),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    detail: text("detail"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at"),
    sentAt: ts("sent_at"),
    /** When it was created. */
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [
    index("notification_deliveries_notification_idx").on(t.notificationId),
    index("notification_deliveries_queue_idx").on(t.status, t.nextAttemptAt),
    index("notification_deliveries_recipient_idx").on(t.recipientUserId, t.at),
  ]
);

/**
 * Read and archived state of a broadcast notification (one for all
 * administrators, or all of one institution's staff), per person, so one
 * person reading it doesn't mark it read for everyone.
 */
export const notificationReceipts = pgTable(
  "notification_receipts",
  {
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: ts("read_at"),
    archivedAt: ts("archived_at"),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })]
);
