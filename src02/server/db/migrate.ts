import "server-only";
import path from "node:path";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { logger } from "@/server/logging/logger";
import { dbDriver, getDb } from "./client";

const MIGRATIONS = path.resolve(process.cwd(), "db/migrations");

/**
 * Applies any migrations in db/migrations not yet recorded in the
 * database. Safe to run repeatedly; drizzle tracks what's applied in its
 * own __drizzle_migrations table.
 */
export async function runMigrations() {
  const log = logger.child({ module: "migrate" });
  const started = Date.now();
  const db = getDb();
  if (dbDriver() === "pglite") await migratePglite(db as unknown as PgliteDatabase, { migrationsFolder: MIGRATIONS });
  else await migratePg(db, { migrationsFolder: MIGRATIONS });
  log.info("Database migrations up to date", { ms: Date.now() - started });
}
