import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { id, ts } from "./_shared";

/**
 * Who changed what, and when. Written by src/server/audit for every
 * create, update and status change made through the API, and for every
 * sign-in. No foreign keys: the trail has to outlive the rows it
 * describes. Append-only: the database refuses to change or delete an
 * entry (trigger audit_log_append_only, migration 0013).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    /** Who did it, as they were named then (name and email): the account may change or go later. */
    actorLabel: text("actor_label"),
    /** "create", "update", "status", "login", "password_reset", ... */
    action: text("action").notNull(),
    /** What the entry is about: authentication, submission, payment, ... (src/lib/audit/categories.ts). */
    category: text("category").notNull().default("other"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    institutionId: text("institution_id"),
    /** Only the fields that changed, before and after. */
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    requestId: text("request_id"),
    ip: text("ip"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_log_category_idx").on(t.category, t.at), index("audit_log_institution_idx").on(t.institutionId, t.at), index("audit_log_entity_idx").on(t.entityType, t.entityId, t.at), index("audit_log_actor_idx").on(t.actorUserId, t.at), index("audit_log_at_idx").on(t.at)]
);
