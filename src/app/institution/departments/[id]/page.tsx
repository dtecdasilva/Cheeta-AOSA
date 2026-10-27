import { requireRole } from "@/lib/auth/guard";
import DepartmentView from "@/components/institution/DepartmentView";
import type { Department, Faculty } from "@/lib/institution/types";
import { departmentResource, facultyResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  // Confined to the caller's own institution: another institution's id is "not found".
  const record = await findOwn<Department>(departmentResource, user, id);
  const faculty = record ? await findOwn<Faculty>(facultyResource, user, record.facultyId) : null;

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Department")} />
      {record ? (
        <DepartmentView department={record} facultyName={faculty?.name} canEdit={user.role === "INSTITUTION_ADMIN"} />
      ) : (
        <EmptyState message={tr("This department doesn't exist, or belongs to another institution.")} />
      )}
    </main>
  );
}
