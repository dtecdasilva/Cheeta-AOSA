import { requireRole } from "@/lib/auth/guard";
import UploadRequirementView from "@/components/institution/UploadRequirementView";
import type { UploadRequirement } from "@/lib/institution/uploadRequirements";
import { uploadRequirementResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  // Confined to the caller's own institution: another institution's id is "not found".
  const record = await findOwn<UploadRequirement>(uploadRequirementResource, user, id);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Upload requirement" />
      {record ? <UploadRequirementView req={record} canEdit={user.role === "INSTITUTION_ADMIN"} /> : <EmptyState message="This requirement doesn't exist, or belongs to another institution." />}
    </main>
  );
}
