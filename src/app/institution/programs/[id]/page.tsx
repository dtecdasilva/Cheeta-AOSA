import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guard";
import ProgramView from "@/components/institution/ProgramView";
import type { Department, Faculty, Program } from "@/lib/institution/types";
import { getDb } from "@/server/db/client";
import { parameters } from "@/server/db/schema";
import { departmentResource, facultyResource, programResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  // Confined to the caller's own institution: another institution's id is "not found".
  const record = await findOwn<Program>(programResource, user, id);
  // The levels above it: Faculty -> Department -> Qualification -> this program.
  const [faculty, department, qualification] = record
    ? await Promise.all([
        findOwn<Faculty>(facultyResource, user, record.facultyId),
        findOwn<Department>(departmentResource, user, record.departmentId),
        getDb().select({ label: parameters.label }).from(parameters).where(eq(parameters.id, record.qualificationId)).limit(1),
      ])
    : [null, null, []];

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Study program" />
      {record ? (
        <ProgramView program={record} facultyName={faculty?.name} departmentName={department?.name} qualificationName={qualification[0]?.label} canEdit={user.role === "INSTITUTION_ADMIN"} />
      ) : (
        <EmptyState message="This program doesn't exist, or belongs to another institution." />
      )}
    </main>
  );
}
