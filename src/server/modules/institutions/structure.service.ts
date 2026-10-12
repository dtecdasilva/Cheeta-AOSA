import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { departments, faculties, institutions, parameters, programs } from "@/server/db/schema";
import { NotFoundError } from "@/server/http/errors";

/**
 * An institution's academic structure as one tree:
 *
 *   Institution -> Faculty/School -> Department -> Qualification -> Study program
 *
 * Faculties, departments and programs are the institution's own records.
 * A qualification (BSc, HND, ...) is one of the platform's qualification
 * types; under a department it groups the programs that lead to it, so it
 * appears wherever the department offers at least one such program.
 */
export async function getStructure(institutionId: string) {
  const db = getDb();
  const [institution] = await db.select({ id: institutions.id, name: institutions.name, status: institutions.status }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!institution) throw new NotFoundError("Institution");

  const [facultyRows, departmentRows, programRows] = await Promise.all([
    db.select().from(faculties).where(eq(faculties.institutionId, institutionId)).orderBy(asc(faculties.name)),
    db.select().from(departments).where(eq(departments.institutionId, institutionId)).orderBy(asc(departments.name)),
    db.select().from(programs).where(eq(programs.institutionId, institutionId)).orderBy(asc(programs.name)),
  ]);
  const qualificationIds = [...new Set(programRows.map((p) => p.qualificationId))];
  const qualificationRows = qualificationIds.length
    ? await db.select({ id: parameters.id, code: parameters.code, label: parameters.label, sortOrder: parameters.sortOrder }).from(parameters).where(inArray(parameters.id, qualificationIds))
    : [];

  return {
    ...institution,
    faculties: facultyRows.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      status: f.status,
      departments: departmentRows
        .filter((d) => d.facultyId === f.id)
        .map((d) => {
          const own = programRows.filter((p) => p.departmentId === d.id);
          return {
            id: d.id,
            code: d.code,
            name: d.name,
            status: d.status,
            qualifications: qualificationRows
              .filter((q) => own.some((p) => p.qualificationId === q.id))
              .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
              .map((q) => ({
                id: q.id,
                code: q.code,
                name: q.label,
                programs: own
                  .filter((p) => p.qualificationId === q.id)
                  .map((p) => ({ id: p.id, code: p.code, name: p.name, durationYears: p.durationYears, studyMode: p.studyMode, language: p.language, availableSpaces: p.availableSpaces, status: p.status })),
              })),
          };
        }),
    })),
  };
}
