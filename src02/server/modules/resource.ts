import "server-only";
import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Role } from "@/lib/auth/roles";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/http/errors";
import { handler } from "@/server/http/handler";
import { created, ok, paged } from "@/server/http/respond";
import { parseBody, parseQuery, pagination } from "@/server/http/validate";

/**
 * A "resource" is a table of configurable records that screens list,
 * filter, add, edit and switch on and off — the backend half of the
 * frontend's RecordManager / Collection pattern. One definition gives:
 *
 *   GET    /collection        list, with ?q= search, filters, ?status=, paging
 *   POST   /collection        create
 *   GET    /collection/:id    one record
 *   PATCH  /collection/:id    partial update (including { status })
 *
 * Records are deactivated, not deleted, matching the screens.
 *
 * When a resource is served to an institution portal, `scope` pins every
 * query to the caller's institution: lists only show its rows, creates are
 * stamped with it, and another institution's ids answer 404.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Table = PgTableWithColumns<any>;
type Row = Record<string, unknown> & { id?: string };

export interface ResourceDef<TCreate extends z.ZodObject> {
  /** Singular, for messages and the audit trail: "faculty". */
  name: string;
  table: Table;
  idColumn: AnyPgColumn;
  /** Prefix for generated ids. Omit when the id comes from the input (currency code). */
  idPrefix?: string;
  /** Builds the id from validated input when there's no prefix. */
  idFrom?: (input: z.infer<TCreate>) => string;
  create: TCreate;
  /** Defaults to every create field optional, plus status. */
  update?: z.ZodObject;
  searchColumns: AnyPgColumn[];
  /** Query parameter → column, matched for equality. */
  filters?: Record<string, AnyPgColumn>;
  orderBy: AnyPgColumn[];
  statusColumn?: AnyPgColumn;
  /** The column holding the owning institution, for institution-scoped access. */
  institutionColumn?: AnyPgColumn;
  /** Unique index name → message for a duplicate. */
  unique?: Record<string, string>;
  /**
   * Checks across records that a schema can't express (the department
   * belongs to the faculty chosen, ...). Throw ValidationError to refuse.
   */
  check?: (db: Executor, next: Row, existing: Row | null) => Promise<void>;
  /** Sets derived fields before saving; gets the merged record and the existing row (null on create). */
  prepare?: (next: Row, existing: Row | null) => Row;
  /** Shapes a row for the response (drop secrets, add derived fields). */
  present?: (row: Row) => Row;
}

export interface Scope {
  institutionId?: string;
}

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

function uniqueMessage(def: ResourceDef<z.ZodObject>, err: unknown): ConflictError | null {
  const e = ((err as { cause?: unknown })?.cause ?? err) as { code?: string; constraint?: string };
  if (e?.code !== "23505") return null;
  return new ConflictError(def.unique?.[e.constraint ?? ""] ?? `This ${def.name} already exists.`);
}

function scopeCondition(def: ResourceDef<z.ZodObject>, scope: Scope): SQL | undefined {
  if (!scope.institutionId) return undefined;
  if (!def.institutionColumn) throw new ForbiddenError();
  return eq(def.institutionColumn, scope.institutionId);
}

export async function listResource(def: ResourceDef<z.ZodObject>, req: NextRequest, scope: Scope) {
  const filterKeys = Object.keys(def.filters ?? {});
  const query = parseQuery(
    req,
    pagination.extend({
      q: z.string().trim().max(100).optional(),
      status: statusSchema.optional(),
      ...Object.fromEntries(filterKeys.map((k) => [k, z.string().max(200).optional()])),
    })
  );

  const conditions: (SQL | undefined)[] = [scopeCondition(def, scope)];
  if (query.status && def.statusColumn) conditions.push(eq(def.statusColumn, query.status));
  for (const k of filterKeys) {
    const v = (query as Record<string, unknown>)[k];
    if (typeof v === "string" && v) conditions.push(eq(def.filters![k], v));
  }
  if (query.q) {
    const words = query.q.split(/\s+/).filter(Boolean).slice(0, 5);
    for (const w of words) conditions.push(or(...def.searchColumns.map((c) => ilike(c, `%${w.replace(/[%_\\]/g, "\\$&")}%`))));
  }
  const where = and(...conditions.filter(Boolean));

  const db = getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(def.table)
      .where(where)
      .orderBy(...def.orderBy.map((c) => asc(c)))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(def.table).where(where),
  ]);
  return { data: rows.map((r) => (def.present ? def.present(r) : r)), meta: { page: query.page, pageSize: query.pageSize, total } };
}

async function findScoped(db: Executor, def: ResourceDef<z.ZodObject>, id: string, scope: Scope): Promise<Row> {
  const [row] = await db
    .select()
    .from(def.table)
    .where(and(eq(def.idColumn, id), scopeCondition(def, scope)))
    .limit(1);
  if (!row) throw new NotFoundError(def.name[0].toUpperCase() + def.name.slice(1));
  return row;
}

export async function getResource(def: ResourceDef<z.ZodObject>, id: string, scope: Scope) {
  const row = await findScoped(getDb(), def, id, scope);
  return def.present ? def.present(row) : row;
}

export async function createResource<T extends z.ZodObject>(def: ResourceDef<T>, input: unknown, scope: Scope) {
  const parsed = def.create.parse(input) as Row;
  if (scope.institutionId && def.institutionColumn) parsed[keyOf(def.institutionColumn)] = scope.institutionId;
  const id = def.idPrefix ? newId(def.idPrefix) : def.idFrom!(parsed as z.infer<T>);
  let record: Row = { ...parsed, [keyOf(def.idColumn)]: id };
  if (def.prepare) record = def.prepare(record, null);

  try {
    const row = await getDb().transaction(async (tx) => {
      await def.check?.(tx, record, null);
      const [inserted] = await tx.insert(def.table).values(record).returning();
      await audit(tx, { action: "create", entityType: def.name, entityId: id, institutionId: (inserted.institutionId as string) ?? null, before: null, after: inserted });
      return inserted;
    });
    return def.present ? def.present(row) : row;
  } catch (err) {
    throw uniqueMessage(def as ResourceDef<z.ZodObject>, err) ?? err;
  }
}

export async function updateResource(def: ResourceDef<z.ZodObject>, id: string, input: unknown, scope: Scope) {
  const schema = def.update ?? def.create.partial().extend({ status: statusSchema.optional() });
  const patch = schema.parse(input) as Row;
  // The owning institution and the id never change through an update.
  if (def.institutionColumn) delete patch[keyOf(def.institutionColumn)];
  delete patch[keyOf(def.idColumn)];

  try {
    const row = await getDb().transaction(async (tx) => {
      const existing = await findScoped(tx, def, id, scope);
      if (Object.keys(patch).length === 0) return existing;
      if (def.prepare) Object.assign(patch, diffKeys(def.prepare({ ...existing, ...patch }, existing), existing));
      await def.check?.(tx, { ...existing, ...patch }, existing);
      const [updated] = await tx.update(def.table).set(patch).where(eq(def.idColumn, id)).returning();
      const action = Object.keys(patch).length === 1 && "status" in patch ? "status" : "update";
      await audit(tx, { action, entityType: def.name, entityId: id, institutionId: (updated.institutionId as string) ?? null, before: existing, after: updated });
      return updated;
    });
    return def.present ? def.present(row) : row;
  } catch (err) {
    throw uniqueMessage(def, err) ?? err;
  }
}

/** Keys of `next` whose values differ from `existing`. */
function diffKeys(next: Row, existing: Row): Row {
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(existing[k])));
}

/** The JS property name drizzle uses for a column. */
function keyOf(column: AnyPgColumn): string {
  const table = column.table as unknown as Record<string, AnyPgColumn>;
  for (const [k, v] of Object.entries(table)) if (v === column) return k;
  return column.name;
}

// ---------------------------------------------------------------------------
// Route factories
// ---------------------------------------------------------------------------

export interface Access {
  /** Who may read. */
  read: readonly Role[];
  /** Who may create and update. */
  write: readonly Role[];
  /** Institution scope for the caller, or undefined for platform-wide access. */
  scope?: (user: PublicUser) => Scope;
}

const scopeFor = (access: Access, user: PublicUser): Scope => access.scope?.(user) ?? {};

export function collectionRoutes(def: ResourceDef<z.ZodObject>, access: Access) {
  return {
    GET: handler({ auth: access.read }, async ({ req, user }) => {
      const result = await listResource(def, req, scopeFor(access, user));
      return paged(result.data, result.meta);
    }),
    POST: handler({ auth: access.read }, async ({ req, user }) => {
      if (!access.write.includes(user.role)) throw new ForbiddenError();
      return created({ data: await createResource(def, await parseBody(req, z.unknown()), scopeFor(access, user)) });
    }),
  };
}

export function itemRoutes(def: ResourceDef<z.ZodObject>, access: Access) {
  return {
    GET: handler<{ id: string }>({ auth: access.read }, async ({ params, user }) => ok({ data: await getResource(def, params.id, scopeFor(access, user)) })),
    PATCH: handler<{ id: string }>({ auth: access.read }, async ({ req, params, user }) => {
      if (!access.write.includes(user.role)) throw new ForbiddenError();
      return ok({ data: await updateResource(def, params.id, await parseBody(req, z.unknown()), scopeFor(access, user)) });
    }),
  };
}

/** Roles and scopes used across the portals. */
export const ADMIN_ONLY: Access = { read: ["AOSA_ADMIN"], write: ["AOSA_ADMIN"] };
export const INSTITUTION_STAFF: Access = {
  read: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"],
  write: ["INSTITUTION_ADMIN"],
  scope: (user) => {
    if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
    return { institutionId: user.institutionId };
  },
};
