import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { logger } from "@/server/logging/logger";
import { getDb } from "./client";

const MIGRATIONS = path.resolve(process.cwd(), "db/migrations");

/** Where drizzle records what has been applied; the same table its own migrator uses. */
const APPLIED = sql`"drizzle"."__drizzle_migrations"`;

interface JournalEntry {
  tag: string;
  when: number;
}

/**
 * Applies every migration in db/migrations that the database hasn't had
 * yet, in the order the journal (meta/_journal.json) lists them, in one
 * transaction: either all of the pending ones are applied or none are.
 *
 * It records each one in drizzle's own table, in drizzle's own format, so
 * drizzle-kit and drizzle's migrator still agree with it. The difference
 * from drizzle's migrator is how "hasn't had yet" is decided. Drizzle's
 * applies a migration only if its journal timestamp is later than the
 * newest one recorded, so a migration whose timestamp is earlier than
 * one already applied (a clock that was ahead, a journal written by
 * hand, two branches merged) is skipped without a word and the app then
 * fails on a missing table. Here a migration is pending unless that
 * migration itself is recorded, by its timestamp or by its content.
 *
 * Two things it refuses to let pass quietly, because both leave a database
 * that claims to be up to date and isn't:
 *
 * - an empty migration file is an error, not something to record as
 *   applied (a file caught half-edited, or not yet filled in);
 * - a migration whose file has changed since it was applied is reported
 *   (`changed` in the result): the database has the old version, and the
 *   new contents will never run.
 *
 * The log line names what was applied, so "did my new migration run?"
 * is answered by reading it.
 */
export interface MigrationReport {
  /** Migrations applied by this run. */
  applied: string[];
  /** Migrations already recorded whose file no longer matches what was applied. */
  changed: string[];
}

/** True if the file has no SQL in it: nothing but whitespace and `--` comments. */
function isEmpty(statements: string[]): boolean {
  return statements.every((statement) => statement.replace(/--[^\n]*/g, "").trim() === "");
}

export async function runMigrations(): Promise<MigrationReport> {
  const log = logger.child({ module: "migrate" });
  const started = Date.now();
  const db = getDb();

  const journalPath = path.join(MIGRATIONS, "meta", "_journal.json");
  if (!existsSync(journalPath)) throw new Error(`No migrations found: ${journalPath} doesn't exist. Run \`npm run db:generate\`.`);
  const journal = (JSON.parse(readFileSync(journalPath, "utf8")) as { entries: JournalEntry[] }).entries;
  // Same order as the journal: readMigrationFiles walks its entries.
  const files = readMigrationFiles({ migrationsFolder: MIGRATIONS });

  // A .sql file the journal doesn't list is never applied. That is almost always a file
  // copied in by hand, or generated in a different copy of the project, so say so.
  const listed = new Set(journal.map((e) => `${e.tag}.sql`));
  const unlisted = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && !listed.has(f));
  if (unlisted.length) {
    log.warn("Migration files that are not in meta/_journal.json will not be applied. Create migrations with `npm run db:generate` in this folder.", { folder: MIGRATIONS, files: unlisted });
  }

  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ${APPLIED} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const recorded = ((await db.execute(sql`SELECT hash, created_at FROM ${APPLIED}`)) as unknown as { rows: { hash: string; created_at: string | number | null }[] }).rows;
  const recordedAt = new Map(recorded.map((r) => [Number(r.created_at), r.hash]));
  const recordedHash = new Set(recorded.map((r) => r.hash));

  const all = files.map((file, i) => ({ ...file, tag: journal[i].tag }));
  const pending = all.filter((m) => !recordedAt.has(m.folderMillis) && !recordedHash.has(m.hash));
  // Recorded as applied, but the file isn't what was applied.
  const changed = all.filter((m) => recordedAt.has(m.folderMillis) && recordedAt.get(m.folderMillis) !== m.hash).map((m) => m.tag);

  const empty = pending.filter((m) => isEmpty(m.sql)).map((m) => m.tag);
  if (empty.length) {
    throw new Error(`Migration ${empty.join(", ")} in ${MIGRATIONS} is empty. Nothing was applied. Put its SQL in the file (or run \`npm run db:generate\` again), then restart.`);
  }
  if (changed.length) {
    log.warn("These migrations were changed after they were applied. The database has the earlier version; the current contents will not run.", { migrations: changed });
  }

  if (pending.length) {
    await db.transaction(async (tx) => {
      for (const migration of pending) {
        log.info("Applying migration", { migration: migration.tag });
        for (const statement of migration.sql) await tx.execute(sql.raw(statement));
        await tx.execute(sql`INSERT INTO ${APPLIED} ("hash", "created_at") VALUES (${migration.hash}, ${migration.folderMillis})`);
      }
    });
  }

  log.info("Database migrations up to date", {
    applied: pending.length ? pending.map((m) => m.tag).join(", ") : "none",
    inJournal: journal.map((e) => e.tag).join(", "),
    ms: Date.now() - started,
  });
  return { applied: pending.map((m) => m.tag), changed };
}
