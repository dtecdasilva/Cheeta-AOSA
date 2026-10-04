import { sql, type SQL } from "drizzle-orm";
import { text, timestamp } from "drizzle-orm/pg-core";

/**
 * Column helpers shared by every table.
 *
 * Ids are text, not UUID columns: seeded rows keep the ids the frontend
 * already uses ("inst-1", "fac-1-1", "payment-method-types:BANK"), so the
 * screens can switch from their local stores to the API without remapping
 * anything. New rows get `<prefix>_<uuid>` ids from newId().
 */

export const id = () => text("id").primaryKey();

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** ACTIVE / INACTIVE, the status every configurable record carries. */
export const RECORD_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const recordStatus = () => text("status", { enum: RECORD_STATUSES }).notNull().default("ACTIVE");

/** `column IN ('A', 'B')` for a CHECK constraint, built from a frontend constant. */
export function oneOf(column: SQL | ReturnType<typeof sql.raw> | unknown, values: readonly string[]): SQL {
  return sql`${column} in (${sql.join(
    values.map((v) => sql.raw(`'${v.replace(/'/g, "''")}'`)),
    sql`, `
  )})`;
}
