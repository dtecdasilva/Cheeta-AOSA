import { sql } from "drizzle-orm";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { dbDriver, getDb } from "@/server/db/client";
import { getStorage } from "@/server/storage/driver";

/** Liveness and readiness: the database answers and storage is reachable. 503 if not. */
export const GET = handler({ auth: "public" }, async ({ log }) => {
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};
  const time = async (name: string, fn: () => Promise<unknown>) => {
    const t = performance.now();
    try {
      await fn();
      checks[name] = { ok: true, ms: Math.round(performance.now() - t) };
    } catch (err) {
      log.error("Health check failed", { check: name, err });
      checks[name] = { ok: false, error: "unavailable" };
    }
  };
  await time("database", () => getDb().execute(sql`select 1`));
  await time("storage", () => getStorage().check());
  const healthy = Object.values(checks).every((c) => c.ok);
  return ok({ status: healthy ? "ok" : "degraded", database: dbDriver(), checks, time: new Date().toISOString() }, { status: healthy ? 200 : 503 });
});
