import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Executor } from "./client";

/** Id for a new row: `<prefix>_<20 hex chars>`. Seeded rows keep the frontend's ids. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Next value of a named counter, starting at 1. Atomic within the transaction. */
export async function nextCounter(db: Executor, key: string): Promise<number> {
  const rows = await db.execute<{ value: number }>(sql`
    insert into counters (key, value) values (${key}, 1)
    on conflict (key) do update set value = counters.value + 1
    returning value
  `);
  return Number(rows.rows[0].value);
}
