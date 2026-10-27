import "server-only";
import { env } from "@/server/config/env";
import { logger } from "@/server/logging/logger";
import { dbDriver, getDb } from "@/server/db/client";
import { runMigrations, type MigrationReport } from "@/server/db/migrate";
import { isDatabaseEmpty, seedDatabase } from "@/server/db/seed";
import { syncAccessCatalogue } from "@/server/auth/access";
import { adoptLegacyExaminationResults } from "@/server/modules/student/legacyResults";
import { adoptLegacyRecords } from "@/server/modules/applications/legacyRecords";
import { upgradeSeededTemplates } from "@/server/notifications/templateUpgrade";
import { openMissingTuitionAccounts } from "@/server/modules/tuition/tuition.service";
import { syncAllMedicalRecords } from "@/server/modules/medical/medical.service";
import { adoptLegacyMatriculations } from "@/server/modules/matriculation/matriculation.service";
import { inviteAccount } from "@/server/modules/accounts/accounts.service";
import { and, eq } from "drizzle-orm";
import { users } from "@/server/db/schema";
import { ConflictError } from "@/server/http/errors";

/**
 * A database without an active Cheeta administrator can't be run: nobody can add institutions, approve payments
 * or invite anyone. If BOOTSTRAP_ADMIN_EMAIL is set, that address is invited as the first administrator.
 */
async function activeAdministrator() {
  const [admin] = await getDb().select({ id: users.id }).from(users).where(and(eq(users.role, "AOSA_ADMIN"), eq(users.status, "ACTIVE"))).limit(1);
  return !!admin;
}

async function ensureAdministrator(log: ReturnType<typeof logger.child>) {
  if (await activeAdministrator()) return;
  if (!env.BOOTSTRAP_ADMIN_EMAIL) {
    log.error("There is no active Cheeta administrator. Set BOOTSTRAP_ADMIN_EMAIL and restart to invite one.");
    return;
  }
  try {
    await inviteAccount({ fullName: env.BOOTSTRAP_ADMIN_NAME, email: env.BOOTSTRAP_ADMIN_EMAIL, role: "AOSA_ADMIN" });
    log.info("First Cheeta administrator invited; their sign-in code has been sent", { email: env.BOOTSTRAP_ADMIN_EMAIL });
  } catch (err) {
    // Another instance starting at the same moment invited them first: nothing to do.
    if (err instanceof ConflictError && (await activeAdministrator())) return;
    // The address belongs to another account (deactivated, or a different role): don't touch it.
    log.error("Could not invite the first administrator: the address belongs to another account", { email: env.BOOTSTRAP_ADMIN_EMAIL, err });
  }
}

/**
 * Server start-up: validate configuration (importing `env` throws on a bad
 * value), bring the schema up to date (AUTO_MIGRATE, on by default;
 * instances starting together take turns on a database lock), seed an
 * empty database, and make sure there is someone to administer it
 * (BOOTSTRAP_ADMIN_EMAIL).
 */
export async function bootstrap() {
  const log = logger.child({ module: "bootstrap" });
  log.info("Starting backend", { env: env.NODE_ENV, database: env.DATABASE_URL ? "postgres" : "pglite", storage: env.STORAGE_DRIVER });
  if (!process.env.SESSION_SECRET) log.warn("SESSION_SECRET is not set; using the development secret. Never run like this in production.");
  if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER === "console") {
    // Applicants sign in with a code sent by email, so without a provider nobody new can get in.
    log.error("EMAIL_PROVIDER is \"console\": emails are only written to the log, so applicants and invited staff will never receive their sign-in codes. Set EMAIL_PROVIDER.");
  }
  if (env.NODE_ENV === "production" && env.SEED_DEMO_DATA) {
    log.error("SEED_DEMO_DATA is on in production: an empty database gets demo accounts with published passwords. Turn it off for a real deployment.");
  }
  if (env.NODE_ENV === "production" && env.STORAGE_DRIVER === "local") {
    log.warn("STORAGE_DRIVER is \"local\": uploads are kept on this server's disk. Run a single instance with a lasting disk, or set STORAGE_DRIVER=database.", { dir: env.STORAGE_LOCAL_DIR });
  }

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
    // Results recorded before they were tied to an examination are attached to one. A no-op once done.
    await db.transaction((tx) => adoptLegacyExaminationResults(tx));
    // Documents, upload requirements and rejected payments stored by earlier versions get the fields added since. Also a no-op once done.
    await db.transaction((tx) => adoptLegacyRecords(tx));
    // Seeded notification templates added or reworded since this database was seeded. A no-op once done.
    await db.transaction((tx) => upgradeSeededTemplates(tx));
    // Tuition accounts for offers taken up before accounts were opened automatically. A no-op once done.
    await db.transaction((tx) => openMissingTuitionAccounts(tx));
    // Medical records for admitted students who don't have them yet. A no-op once done.
    await db.transaction((tx) => syncAllMedicalRecords(tx));
    // Matriculations recorded before they carried the student, institution and program. A no-op once done.
    await db.transaction((tx) => adoptLegacyMatriculations(tx));
    await ensureAdministrator(log);
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
