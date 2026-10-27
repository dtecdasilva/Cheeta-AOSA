import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { INSTITUTION_TYPES } from "@/lib/data";
import type { InstitutionType } from "@/lib/types";
import { getDb } from "@/server/db/client";
import { parameters } from "@/server/db/schema";

/**
 * The institution types an applicant can register for: the ones Cheeta
 * administration has active under Institution parameters, among the types
 * the platform supports (each has its own application experience). In the
 * order set there. Falls back to every supported type if none is active.
 */
export async function registrableInstitutionTypes(): Promise<InstitutionType[]> {
  const rows = await getDb()
    .select({ label: parameters.label })
    .from(parameters)
    .where(and(eq(parameters.category, "institution-types"), eq(parameters.status, "ACTIVE")))
    .orderBy(asc(parameters.sortOrder), asc(parameters.label));
  const active = rows.map((r) => r.label).filter((l): l is InstitutionType => INSTITUTION_TYPES.includes(l as InstitutionType));
  return active.length ? active : INSTITUTION_TYPES;
}
