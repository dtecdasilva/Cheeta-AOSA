import { and, asc, eq } from "drizzle-orm";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDb } from "@/server/db/client";
import { departments, faculties, parameters, programs } from "@/server/db/schema";

/** An institution's active programs with their faculty, department and qualification, for program selection. */
export const GET = handler<{ id: string }>({ auth: "authenticated" }, async ({ params }) => {
  const rows = await getDb()
    .select({
      id: programs.id,
      code: programs.code,
      name: programs.name,
      availableSpaces: programs.availableSpaces,
      durationYears: programs.durationYears,
      studyMode: programs.studyMode,
      language: programs.language,
      facultyId: faculties.id,
      faculty: faculties.name,
      departmentId: departments.id,
      department: departments.name,
      qualification: parameters.label,
    })
    .from(programs)
    .innerJoin(faculties, eq(faculties.id, programs.facultyId))
    .innerJoin(departments, eq(departments.id, programs.departmentId))
    .innerJoin(parameters, eq(parameters.id, programs.qualificationId))
    .where(and(eq(programs.institutionId, params.id), eq(programs.status, "ACTIVE")))
    .orderBy(asc(faculties.name), asc(departments.name), asc(programs.name));
  return ok({ data: rows });
});
