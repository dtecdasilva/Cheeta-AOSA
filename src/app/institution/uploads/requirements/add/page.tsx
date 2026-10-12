import { requireRole } from "@/lib/auth/guard";
import UploadRequirementForm from "@/components/institution/UploadRequirementForm";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";
import { getDb } from "@/server/db/client";
import { documentTypeOptions } from "@/server/modules/institutions/institutions.resources";

export default async function Page() {
  // Only an institution administrator can change the institution's records; the API enforces the same.
  const user = await requireRole(["INSTITUTION_ADMIN"]);
  // The document types on offer, each marked if this institution already asks for it.
  const documentTypes = user.institutionId ? await documentTypeOptions(getDb(), user.institutionId) : null;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add upload requirement" description="Define a document applicants must upload." />
      {documentTypes ? <UploadRequirementForm documentTypes={documentTypes} /> : <EmptyState message="This account isn't linked to an institution." />}
    </main>
  );
}
