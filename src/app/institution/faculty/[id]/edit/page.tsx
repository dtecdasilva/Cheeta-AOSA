import { requireRole } from "@/lib/auth/guard";
import FacultyForm from "@/components/institution/FacultyForm";
import type { Faculty } from "@/lib/institution/types";
import { facultyResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN"]);
  const { id } = await params;
  // Read from the database, confined to the caller's own institution: an id that
  // belongs to another institution is "not found", exactly as if it didn't exist.
  const record = await findOwn<Faculty>(facultyResource, user, id);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Edit faculty")} />
      {record ? <FacultyForm initial={record} /> : <EmptyState message={tr("This faculty doesn't exist, or belongs to another institution.")} />}
    </main>
  );
}
