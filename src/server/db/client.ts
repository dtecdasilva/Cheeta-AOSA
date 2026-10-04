import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { env } from "@/server/config/env";
import { logger } from "@/server/logging/logger";
import * as schema from "./schema";

/**
 * The one database handle. With DATABASE_URL set it's a node-postgres pool;
 * without it (development and tests only — env.ts refuses that in
 * production) it's PGlite, a real Postgres running in-process, storing its
 * data in PGLITE_DATA_DIR. Both speak the same SQL and run the same
 * migrations, so nothing above this file knows which one it got.
 *
 * Kept on globalThis because Next compiles route handlers and server
 * components into separate module graphs; a module-level variable would
 * open a second pool (or, with PGlite, a second writer on the same files).
 */

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything a repository can run queries on: the db or an open transaction. */
export type Executor = Db | Tx;

interface Handle {
  db: Db;
  driver: "postgres" | "pglite";
  close: () => Promise<void>;
}

const KEY = Symbol.for("cheeta-aosa.db");
const g = globalThis as unknown as { [KEY]?: Handle };
const log = logger.child({ module: "db" });

function open(): Handle {
  if (env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => log.error("Idle database client error", { err }));
    log.info("Connected to PostgreSQL", { poolMax: env.DATABASE_POOL_MAX });
    return { db: drizzlePg(pool, { schema }), driver: "postgres", close: () => pool.end() };
  }

  // Runtime data, not code: keep the bundler from tracing it into the deployment.
  const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.PGLITE_DATA_DIR);
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  log.info("Using embedded PGlite database", { dir: env.PGLITE_DATA_DIR });
  // The PGlite and node-postgres drivers expose the same query API.
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return { db, driver: "pglite", close: () => client.close() };
}

function handle(): Handle {
  return (g[KEY] ??= open());
}

export function getDb(): Db {
  return handle().db;
}

export function dbDriver(): Handle["driver"] {
  return handle().driver;
}

export async function closeDb() {
  const h = g[KEY];
  if (!h) return;
  g[KEY] = undefined;
  await h.close();
}

export { schema };
