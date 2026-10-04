import "server-only";
import { z } from "zod";

/**
 * Every environment variable the backend reads, validated once. Import
 * `env` from here instead of reading `process.env` directly, so a missing
 * or malformed value fails at startup with a clear message rather than
 * deep inside a request.
 *
 * The one exception is SESSION_SECRET, which src/lib/auth/token.ts reads
 * itself because it also runs in the Edge proxy, where this module can't
 * be imported. It is still validated here.
 *
 * See .env.example for what each variable does.
 */

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : v === "true" || v === "1"));

const isProd = process.env.NODE_ENV === "production";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),

    // Database. Unset outside production = embedded PGlite in PGLITE_DATA_DIR.
    DATABASE_URL: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DATABASE_SSL: bool(false),
    PGLITE_DATA_DIR: z.string().default(".data/pglite"),
    AUTO_MIGRATE: bool(!isProd),
    SEED_DEMO_DATA: bool(!isProd),

    SESSION_SECRET: z.string().optional(),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default(isProd ? "info" : "debug"),
    LOG_FORMAT: z.enum(["json", "pretty"]).default(isProd ? "json" : "pretty"),

    STORAGE_DRIVER: z.enum(["local"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default(".data/uploads"),
    STORAGE_MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
    /** Lifetime of a signed file download link. */
    STORAGE_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().min(30).max(86_400).default(300),

    EMAIL_PROVIDER: z.enum(["console"]).default("console"),
    SMS_PROVIDER: z.enum(["console"]).default("console"),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== "production") return;
    if (!v.DATABASE_URL) ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "is required in production" });
    if (!v.SESSION_SECRET || v.SESSION_SECRET.length < 32)
      ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "must be set to at least 32 random characters in production" });
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}\nSee .env.example.`);
  }
  return parsed.data;
}

export const env: Env = load();
