import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { parameters } from "@/server/db/schema";

/** The names of a region and a town, for a page that shows a record's place. */
export async function placeNames(regionId: string | null | undefined, townId: string | null | undefined) {
  const ids = [regionId, townId].filter((x): x is string => !!x);
  const rows = ids.length ? await getDb().select({ id: parameters.id, label: parameters.label }).from(parameters).where(inArray(parameters.id, ids)) : [];
  const name = (id: string | null | undefined) => rows.find((r) => r.id === id)?.label ?? "";
  return { region: name(regionId), town: name(townId) };
}
