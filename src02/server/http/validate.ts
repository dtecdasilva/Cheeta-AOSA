import "server-only";
import { z } from "zod";
import { BadRequestError, ValidationError } from "./errors";

/**
 * Request parsing. Every handler reads its input through these, so
 * malformed JSON and schema failures produce the same 400 shape everywhere:
 * `{ error: "Some fields need attention.", fieldErrors: { field: message } }`.
 */

export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function parseWith<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(toFieldErrors(result.error));
  return result.data;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequestError("Malformed request body.");
  }
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  return parseWith(schema, await readJson(req));
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const params = new URL(req.url).searchParams;
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    obj[key] = all.length > 1 ? all : all[0];
  }
  return parseWith(schema, obj);
}

// ---------------------------------------------------------------------------
// Reusable pieces
// ---------------------------------------------------------------------------

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export const statusFilter = z.enum(["ACTIVE", "INACTIVE"]).optional();

/** Trimmed text; empty strings rejected when required. */
export const text = (max = 500) => z.string().trim().max(max);
export const requiredText = (max = 500) => z.string().trim().min(1, "This field is required.").max(max);
