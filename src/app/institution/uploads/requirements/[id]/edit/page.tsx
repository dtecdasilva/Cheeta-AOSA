import { requireRole } from "@/lib/auth/guard";
import UploadRequirementForm from "@/components/institution/UploadRequirementForm";
import type { UploadRequirement } from "@/lib/institution/uploadRequirements";
import { getDb } from "@/server/db/client";
import { documentTypeOptions, uploadRequirementResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN"]);
  const { id } = await params;
  // Read from the database, confined to the caller's own institution: an id that
  // belongs to another institution is "not found", exactly as if it didn't exist.
  const record = await findOwn<UploadRequirement>(uploadRequirementResource, user, id);
  const documentTypes = record && user.institutionId ? await documentTypeOptions(getDb(), user.institutionId) : [];

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Edit upload requirement")} />
      {record ? <UploadRequirementForm initial={record} documentTypes={documentTypes} /> : <EmptyState message={tr("This requirement doesn't exist, or belongs to another institution.")} />}
    </main>
  );
}
