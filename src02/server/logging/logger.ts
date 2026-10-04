import "server-only";
import { env } from "@/server/config/env";
import { getRequestContext } from "./context";

/**
 * Structured logger. One JSON object per line in production (what log
 * collectors expect), a readable single line in development. Every line
 * carries the current request id when there is one.
 *
 * Values under sensitive keys are replaced before anything is written, so
 * a careless `log.info("login", { body })` can't leak a password.
 */

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT = /password|passwordHash|secret|token|authorization|cookie|temporaryCode/i;

export type LogFields = Record<string, unknown>;

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: env.NODE_ENV === "production" ? undefined : value.stack, cause: value.cause ? sanitize(value.cause, depth + 1) : undefined };
  }
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? "[redacted]" : sanitize(v, depth + 1);
  return out;
}

function write(level: Level, msg: string, fields: LogFields, bound: LogFields) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const ctx = getRequestContext();
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    ...(ctx ? { requestId: ctx.requestId, userId: ctx.userId } : {}),
    ...(sanitize({ ...bound, ...fields }) as LogFields),
  };
  const stream = level === "error" || level === "warn" ? console.error : console.log;
  if (env.LOG_FORMAT === "json") {
    stream(JSON.stringify(entry));
    return;
  }
  const { time, level: l, msg: m, requestId, ...rest } = entry as Record<string, unknown>;
  const extra = Object.entries(rest).filter(([, v]) => v !== undefined);
  stream(
    `${String(time).slice(11, 23)} ${String(l).toUpperCase().padEnd(5)} ${m}` +
      (requestId ? ` [${String(requestId).slice(0, 8)}]` : "") +
      (extra.length ? " " + extra.map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ") : "")
  );
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** A logger that adds `fields` to every line, e.g. `{ module: "storage" }`. */
  child(fields: LogFields): Logger;
}

function make(bound: LogFields): Logger {
  return {
    debug: (m, f = {}) => write("debug", m, f, bound),
    info: (m, f = {}) => write("info", m, f, bound),
    warn: (m, f = {}) => write("warn", m, f, bound),
    error: (m, f = {}) => write("error", m, f, bound),
    child: (f) => make({ ...bound, ...f }),
  };
}

export const logger: Logger = make({});
