import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit reads the TypeScript schema and writes SQL migrations to
 * db/migrations (`npm run db:generate`). Applying them is done by the app
 * itself (src/server/db/migrate.ts), against Postgres or PGlite alike.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./db/migrations",
  strict: true,
  verbose: true,
});
