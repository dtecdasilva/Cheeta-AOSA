import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { AnyPgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";
import type { ParamCategory } from "@/lib/admin/parameters";
import type { Executor } from "@/server/db/client";
import { parameters } from "@/server/db/schema";
import { ValidationError } from "@/server/http/errors";

/**
 * Cross-record checks shared by resource definitions and services. Each
 * throws a ValidationError naming the field, the same 400 a schema failure
 * gives.
 */

/** The id is a parameter in one of `categories`; returns it. */
export async function assertParam(db: Executor, field: string, id: unknown, categories: ParamCategory | ParamCategory[]) {
  if (id === null || id === undefined || id === "") return null;
  const cats = Array.isArray(categories) ? categories : [categories];
  const [row] = await db
    .select()
    .from(parameters)
    .where(and(eq(parameters.id, String(id)), inArray(parameters.category, cats)))
    .limit(1);
  if (!row) throw new ValidationError({ [field]: "Choose an option from the list." });
  return row;
}

/** A location parameter sits under the expected parent (a town in its region, ...). */
export async function assertParamParent(db: Executor, field: string, childId: unknown, parentId: unknown, message: string) {
  if (!childId || !parentId) return;
  const [row] = await db.select({ parentId: parameters.parentId }).from(parameters).where(eq(parameters.id, String(childId))).limit(1);
  if (row && row.parentId !== parentId) throw new ValidationError({ [field]: message });
}

/** A row exists in `table` with `column = value`, optionally owned by an institution; returns it. */
export async function assertBelongs(
  db: Executor,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: PgTableWithColumns<any>,
  field: string,
  id: unknown,
  conditions: { column: AnyPgColumn; value: unknown }[],
  message: string
) {
  if (!id) return null;
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, String(id)), ...conditions.map((c) => eq(c.column, c.value))))
    .limit(1);
  if (!row) throw new ValidationError({ [field]: message });
  return row;
}

/** Refuses to deactivate a record while active children depend on it. */
export async function assertNoActiveChildren(
  db: Executor,
  next: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  child: PgTableWithColumns<any>,
  foreignKey: AnyPgColumn,
  message: string
) {
  if (!existing || existing.status !== "ACTIVE" || next.status !== "INACTIVE") return;
  const [row] = await db
    .select({ id: child.id })
    .from(child)
    .where(and(eq(foreignKey, String(existing.id)), eq(child.status, "ACTIVE")))
    .limit(1);
  if (row) throw new ValidationError({ status: message });
}
