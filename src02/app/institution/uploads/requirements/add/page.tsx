import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import UploadRequirementForm from "@/components/institution/UploadRequirementForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add upload requirement" description="Define a document applicants must upload." />
      <UploadRequirementForm institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
