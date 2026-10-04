import "server-only";
import { env } from "@/server/config/env";
import { logger } from "@/server/logging/logger";
import { dbDriver, getDb } from "@/server/db/client";
import { runMigrations, type MigrationReport } from "@/server/db/migrate";
import { isDatabaseEmpty, seedDatabase } from "@/server/db/seed";
import { syncAccessCatalogue } from "@/server/auth/access";

/**
 * Server start-up: validate configuration (importing `env` throws on a bad
 * value), bring the schema up to date when AUTO_MIGRATE is on, and seed an
 * empty database. In production AUTO_MIGRATE defaults to off — run
 * `npm run db:migrate` as a deploy step instead, so several instances
 * starting at once don't race to migrate.
 */
export async function bootstrap() {
  const log = logger.child({ module: "bootstrap" });
  log.info("Starting backend", { env: env.NODE_ENV, database: env.DATABASE_URL ? "postgres" : "pglite", storage: env.STORAGE_DRIVER });
  if (!process.env.SESSION_SECRET) log.warn("SESSION_SECRET is not set; using the development secret. Never run like this in production.");

  let migrations: MigrationReport | undefined;
  try {
    if (env.AUTO_MIGRATE) migrations = await runMigrations();
    const db = getDb();
    // Roles and permissions are defined in code; bring their tables in line before anything reads them.
    await db.transaction((tx) => syncAccessCatalogue(tx));
    if (await isDatabaseEmpty(db)) {
      log.info("Empty database: loading seed data", { demo: env.SEED_DEMO_DATA });
      await seedDatabase(db, { demo: env.SEED_DEMO_DATA });
    }
    log.info("Backend ready", { database: dbDriver() });
  } catch (err) {
    // The commonest cause by far: the code was updated but no migration was generated
    // for its schema changes, so a table or column it needs isn't there. Say so plainly
    // instead of leaving a raw "relation does not exist" to be decoded.
    if (isSchemaBehind(err)) {
      const behind = "The database is behind the code: a table or column the app needs doesn't exist. ";
      const message = migrations?.changed.length
        ? // Every migration is recorded as applied, but one was recorded with different contents
          // (edited afterwards, or caught empty), so what it creates was never created.
          behind +
          `The database has ${migrations.changed.join(", ")} recorded as applied, but that file has changed since, so its current contents never ran. ` +
          (env.DATABASE_URL
            ? "Put the missing changes in a new migration (`npm run db:generate`) instead of editing one that has been applied."
            : `For this embedded development database, stop the server, delete the ${env.PGLITE_DATA_DIR.split("/")[0]} folder and start again: it is rebuilt from the migrations and re-seeded.`)
        : behind +
          "The migrations in db/migrations don't cover the current schema (src/server/db/schema). " +
          "Run `npm run db:generate` to create the missing migration, then start the app again" +
          (env.AUTO_MIGRATE ? "; it is applied at start-up." : " after `npm run db:migrate`.");
      log.error(message, { missing: causeOf(err)?.message });
      throw new Error(message, { cause: err });
    }
    log.error("Backend start-up failed", { err });
    // Fail loudly: serving requests against a half-migrated database is worse than not starting.
    throw err;
  }
}

type PgError = { code?: string; message?: string; cause?: unknown };

/** The database's own error, under whatever the query layer wrapped it in. */
function causeOf(err: unknown): PgError | undefined {
  let e = err as PgError | undefined;
  for (let depth = 0; e && depth < 5; depth++) {
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) return e;
    e = e.cause as PgError | undefined;
  }
  return undefined;
}

/** Postgres 42P01 (undefined table) or 42703 (undefined column). */
function isSchemaBehind(err: unknown): boolean {
  const code = causeOf(err)?.code;
  return code === "42P01" || code === "42703";
}
