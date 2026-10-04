import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { CATEGORY_DEFS } from "@/lib/admin/parameters";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseQuery } from "@/server/http/validate";
import { getDb } from "@/server/db/client";
import { parameters } from "@/server/db/schema";

const query = z.object({ category: z.enum(CATEGORY_DEFS.map((d) => d.key) as [string, ...string[]]), parentId: z.string().max(200).optional() });

/** Active options in one parameter list, for any form that picks from it. */
export const GET = handler({ auth: "authenticated" }, async ({ req }) => {
  const q = parseQuery(req, query);
  const rows = await getDb()
    .select({ id: parameters.id, code: parameters.code, label: parameters.label, parentId: parameters.parentId, attrs: parameters.attrs })
    .from(parameters)
    .where(and(eq(parameters.category, q.category), eq(parameters.status, "ACTIVE"), q.parentId ? eq(parameters.parentId, q.parentId) : undefined))
    .orderBy(asc(parameters.sortOrder), asc(parameters.label));
  return ok({ data: rows });
});
