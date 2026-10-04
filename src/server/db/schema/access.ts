import { boolean, check, index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { PORTALS } from "../../../lib/auth/roles";
import { oneOf, timestamps, ts } from "./_shared";

/**
 * Roles, permissions and which role holds which permission.
 *
 * These three tables are a catalogue, not user-editable data: their rows
 * come from src/lib/auth/roles.ts and src/lib/auth/permissions.ts and are
 * brought in line with those files every time the server starts
 * (src/server/auth/access.ts). They exist in the database so that an
 * account's role is a real foreign key, permission grants can be joined
 * and audited, and reports can read them without importing code.
 *
 * The three-portal rule lives here: a role belongs to exactly one portal,
 * and an account has exactly one role (users.role), so an account can
 * only ever be inside one portal.
 */

export const roles = pgTable(
  "roles",
  {
    /** The role's code, as used throughout the app: "STUDENT", "AOSA_ADMIN", ... */
    key: text("key").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** STUDENT, INSTITUTION or ADMIN: the one portal this role signs in to. */
    portal: text("portal", { enum: PORTALS as [string, ...string[]] }).notNull(),
    ...timestamps,
  },
  (t) => [index("roles_portal_idx").on(t.portal), check("roles_portal_check", oneOf(t.portal, PORTALS))]
);

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  /**
   * True when the permission can be granted to accounts one by one
   * (user_permissions) rather than only through a role.
   */
  assignable: boolean("assignable").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** Permissions every account with the role has. */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade", onUpdate: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roleKey, t.permissionKey] }), index("role_permissions_permission_idx").on(t.permissionKey)]
);
