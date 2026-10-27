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
    /** Apply pending migrations at start-up. On by default everywhere; instances starting together take turns on a database lock. */
    AUTO_MIGRATE: bool(true),
    SEED_DEMO_DATA: bool(!isProd),

    SESSION_SECRET: z.string().optional(),

    /**
     * The first Cheeta administrator. When the database has no active administrator, start-up invites this address
     * as one and emails it a sign-in code (the same invitation as Access management sends). Ignored once one exists.
     */
    BOOTSTRAP_ADMIN_EMAIL: z.email().optional().or(z.literal("").transform(() => undefined)),
    BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(200).default("Cheeta administrator"),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default(isProd ? "info" : "debug"),
    LOG_FORMAT: z.enum(["json", "pretty"]).default(isProd ? "json" : "pretty"),

    /**
     * Where uploaded files are kept: "local" (a folder on this server's disk) or "database" (in the database, for hosting
     * without a lasting disk). Unset, it is "database" on Vercel, where the disk is discarded between requests, and "local" elsewhere.
     */
    STORAGE_DRIVER: z.enum(["local", "database"]).default(process.env.VERCEL ? "database" : "local"),
    STORAGE_LOCAL_DIR: z.string().default(".data/uploads"),
    /**
     * The largest file anyone can upload. No upload requirement can ask for more, and applicants are never told a bigger limit.
     * Unset, it is 10 MB, or 4 MB on Vercel, which refuses any request over about 4.5 MB before it reaches the app.
     */
    STORAGE_MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(process.env.VERCEL ? 4 : 10),

    /**
     * Who sends email and SMS. "console" only logs (the default, for
     * development and until a provider is chosen). Each provider reads its
     * own settings below; adding another is one entry in
     * server/notifications/providers.ts.
     */
    EMAIL_PROVIDER: z.enum(["console", "resend", "webhook"]).default("console"),
    SMS_PROVIDER: z.enum(["console", "twilio", "webhook"]).default("console"),
    /** Sender address for email, e.g. "admissions@cheeta-aosa.com". The display name comes from the system settings. */
    EMAIL_FROM: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    /** Generic HTTP providers: the message is POSTed as JSON to this URL, with the token as a Bearer header. Fits most local SMS aggregators. */
    EMAIL_WEBHOOK_URL: z.url().optional(),
    EMAIL_WEBHOOK_TOKEN: z.string().optional(),
    SMS_WEBHOOK_URL: z.url().optional(),
    SMS_WEBHOOK_TOKEN: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    /** Twilio sender: a number or an alphanumeric sender ID. */
    TWILIO_FROM: z.string().optional(),
    /** Lets a scheduler (Vercel Cron) call /api/cron/notifications to send what is waiting and retry failures. */
    CRON_SECRET: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== "production") return;
    if (!v.DATABASE_URL) ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "is required in production" });
    if (!v.SESSION_SECRET || v.SESSION_SECRET.length < 32)
      ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "must be set to at least 32 random characters in production" });
    const need = (key: keyof typeof v, when: boolean) => when && !v[key] && ctx.addIssue({ code: "custom", path: [key], message: "is required by the chosen provider" });
    need("RESEND_API_KEY", v.EMAIL_PROVIDER === "resend");
    need("EMAIL_FROM", v.EMAIL_PROVIDER === "resend");
    need("EMAIL_WEBHOOK_URL", v.EMAIL_PROVIDER === "webhook");
    need("SMS_WEBHOOK_URL", v.SMS_PROVIDER === "webhook");
    need("TWILIO_ACCOUNT_SID", v.SMS_PROVIDER === "twilio");
    need("TWILIO_AUTH_TOKEN", v.SMS_PROVIDER === "twilio");
    need("TWILIO_FROM", v.SMS_PROVIDER === "twilio");
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
