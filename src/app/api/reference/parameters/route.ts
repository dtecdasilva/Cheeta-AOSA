import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { CATEGORY_DEFS } from "@/lib/admin/parameters";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseQuery } from "@/server/http/validate";
import { getDb } from "@/server/db/client";
import { parameters } from "@/server/db/schema";

const query = z.object({ category: z.enum(CATEGORY_DEFS.map((d) => d.key) as [string, ...string[]]).optional(), parentId: z.string().max(200).optional() });

/**
 * Active options in the parameter lists, for any form that picks from them:
 * one list with ?category= (and ?parentId=), or every active item without.
 * Inactive items and anything only administration sees stay out.
 */
export const GET = handler({ auth: "authenticated" }, async ({ req }) => {
  const q = parseQuery(req, query);
  const rows = await getDb()
    .select({ id: parameters.id, category: parameters.category, code: parameters.code, label: parameters.label, description: parameters.description, sortOrder: parameters.sortOrder, parentId: parameters.parentId, attrs: parameters.attrs })
    .from(parameters)
    .where(and(q.category ? eq(parameters.category, q.category) : undefined, eq(parameters.status, "ACTIVE"), q.parentId ? eq(parameters.parentId, q.parentId) : undefined))
    .orderBy(asc(parameters.category), asc(parameters.sortOrder), asc(parameters.label));
  return ok({ data: rows });
});
