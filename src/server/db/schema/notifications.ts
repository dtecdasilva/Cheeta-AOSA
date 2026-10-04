import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
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

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: id(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["IN_APP", "EMAIL", "SMS"] }).notNull(),
    destination: text("destination").notNull(),
    status: text("status", { enum: ["DELIVERED", "SENT", "FAILED"] }).notNull(),
    detail: text("detail"),
    providerRef: text("provider_ref"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("notification_deliveries_notification_idx").on(t.notificationId)]
);
