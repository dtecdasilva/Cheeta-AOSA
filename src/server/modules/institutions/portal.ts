import "server-only";
import type { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { NotFoundError } from "@/server/http/errors";
import { getResource, INSTITUTION_STAFF, type ResourceDef } from "@/server/modules/resource";

/**
 * For the institution portal's own pages: one of the signed-in
 * institution's records, or null if it doesn't exist or belongs to
 * another institution. The two cases are deliberately indistinguishable.
 */
export async function findOwn<T>(def: ResourceDef<z.ZodObject>, user: PublicUser, id: string): Promise<T | null> {
  try {
    const row = await getResource(def, id, INSTITUTION_STAFF.scope!(user));
    // Dates become strings so the record can be handed to a client component.
    return JSON.parse(JSON.stringify(row)) as T;
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}
