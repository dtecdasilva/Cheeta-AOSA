import { requireRole } from "@/lib/auth/guard";
import DepartmentForm from "@/components/institution/DepartmentForm";
import type { Department } from "@/lib/institution/types";
import { departmentResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN"]);
  const { id } = await params;
  // Read from the database, confined to the caller's own institution: an id that
  // belongs to another institution is "not found", exactly as if it didn't exist.
  const record = await findOwn<Department>(departmentResource, user, id);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Edit department")} />
      {record ? <DepartmentForm initial={record} /> : <EmptyState message={tr("This department doesn't exist, or belongs to another institution.")} />}
    </main>
  );
}
