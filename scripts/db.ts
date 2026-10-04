/**
 * Database tasks outside the web server:
 *
 *   npm run db:migrate   apply pending migrations (a deploy step in production)
 *   npm run db:seed      load seed data into an empty database
 *   npm run db:reset     drop everything, migrate and seed (refuses in production)
 *
 * Reads .env / .env.local like Next does. Stop `next dev` first when using
 * the embedded PGlite database: only one process may open its data folder.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const command = process.argv[2];
  const { env } = await import("../src/server/config/env");
  const { getDb, closeDb } = await import("../src/server/db/client");
  const { runMigrations } = await import("../src/server/db/migrate");
  const { isDatabaseEmpty, seedDatabase } = await import("../src/server/db/seed");
  const { sql } = await import("drizzle-orm");

  try {
    switch (command) {
      case "migrate":
        await runMigrations();
        break;
      case "seed": {
        await runMigrations();
        if (!(await isDatabaseEmpty(getDb()))) {
          console.log("The database already has data; nothing seeded. Use db:reset to start over.");
          break;
        }
        await seedDatabase(getDb(), { demo: env.SEED_DEMO_DATA });
        break;
      }
      case "reset": {
        if (env.NODE_ENV === "production") throw new Error("Refusing to reset a production database.");
        await getDb().execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
        await runMigrations();
        await seedDatabase(getDb(), { demo: env.SEED_DEMO_DATA });
        break;
      }
      default:
        console.error("Usage: tsx scripts/db.ts <migrate|seed|reset>");
        process.exitCode = 1;
    }
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
