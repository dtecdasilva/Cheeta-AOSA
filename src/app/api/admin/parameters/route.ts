import { NextRequest } from "next/server";
import { CATEGORY_DEFS } from "@/lib/admin/parameters";
import { ADMIN_ONLY, collectionRoutes, listResource } from "@/server/modules/resource";
import { parameterResource } from "@/server/modules/reference/reference.resources";
import { handler } from "@/server/http/handler";
import { NotFoundError } from "@/server/http/errors";
import { paged } from "@/server/http/respond";

const GROUPS = new Set<string>(CATEGORY_DEFS.map((d) => d.group));

/**
 * Every configuration list Cheeta administration keeps: Institution,
 * Examination, Application and Location parameters.
 *
 * GET ?group=institution|examination|application|location narrows to one
 * group's lists; ?category= to one list (comma-separated for several);
 * also ?parentId=, ?status=, ?q=, paged. POST adds an item.
 */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const group = req.nextUrl.searchParams.get("group");
  let request = req;
  if (group) {
    if (!GROUPS.has(group)) throw new NotFoundError("Parameter group");
    const url = new URL(req.url);
    url.searchParams.delete("group");
    if (!url.searchParams.get("category")) url.searchParams.set("category", CATEGORY_DEFS.filter((d) => d.group === group).map((d) => d.key).join(","));
    request = new NextRequest(url);
  }
  const r = await listResource(parameterResource, request, {});
  return paged(r.data, r.meta);
});
export const POST = collectionRoutes(parameterResource, ADMIN_ONLY).POST;
