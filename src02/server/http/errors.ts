import "server-only";

/**
 * Errors a service can throw to produce a specific HTTP response. Anything
 * else that escapes a handler becomes a 500 with a request id and no
 * internal detail (see handler.ts).
 *
 * The JSON body keeps the shape the frontend already reads —
 * `{ error, fieldErrors?, field?, accountExists? }` — and adds `code` and
 * `requestId`.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Extra keys merged into the response body. */
    public readonly extra: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "The request could not be understood.", extra?: Record<string, unknown>) {
    super(400, "BAD_REQUEST", message, extra);
  }
}

/** Field-level problems; `fieldErrors` maps a field name to its message. */
export class ValidationError extends AppError {
  constructor(public readonly fieldErrors: Record<string, string>, message = "Some fields need attention.") {
    super(400, "VALIDATION_FAILED", message, { fieldErrors });
  }

  /** Throws if `errors` has any entries; for validators that return an error map. */
  static assert(errors: Record<string, string | undefined>, message?: string) {
    const found = Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Record<string, string>;
    if (Object.keys(found).length) throw new ValidationError(found, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not signed in.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Record") {
    super(404, "NOT_FOUND", `${what} not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, extra?: Record<string, unknown>) {
    super(409, "CONFLICT", message, extra);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string) {
    super(413, "PAYLOAD_TOO_LARGE", message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string) {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}

/**
 * Postgres error codes worth turning into a 4xx rather than a 500: a unique
 * index the service didn't pre-check, or a reference to a row that doesn't
 * exist. Services should check first for a friendly message; this is the net.
 */
export function fromDatabaseError(err: unknown): AppError | null {
  const e = (err as { cause?: unknown })?.cause ?? err;
  const code = (e as { code?: string })?.code;
  if (code === "23505") return new ConflictError("A record with these details already exists.");
  if (code === "23503") return new BadRequestError("A referenced record doesn't exist.");
  if (code === "23514") return new BadRequestError("A value isn't one of the allowed options.");
  return null;
}
