import "server-only";
import { env } from "@/server/config/env";
import { logger } from "@/server/logging/logger";
import { dbDriver, getDb } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { isDatabaseEmpty, seedDatabase } from "@/server/db/seed";

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

  try {
    if (env.AUTO_MIGRATE) await runMigrations();
    const db = getDb();
    if (await isDatabaseEmpty(db)) {
      log.info("Empty database: loading seed data", { demo: env.SEED_DEMO_DATA });
      await seedDatabase(db, { demo: env.SEED_DEMO_DATA });
    }
    log.info("Backend ready", { database: dbDriver() });
  } catch (err) {
    log.error("Backend start-up failed", { err });
    // Fail loudly: serving requests against a half-migrated database is worse than not starting.
    throw err;
  }
}
