import { requireRole } from "@/lib/auth/guard";
import UploadRequirementsList from "@/components/institution/UploadRequirementsList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Upload Requirements" description="Documents applicants must provide with their application." />
      <UploadRequirementsList />
    </main>
  );
}
