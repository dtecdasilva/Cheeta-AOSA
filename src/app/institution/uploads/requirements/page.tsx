import { requireRole } from "@/lib/auth/guard";
import UploadRequirementsList from "@/components/institution/UploadRequirementsList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Upload Requirements")} description={tr("Documents applicants must provide with their application.")} />
      <UploadRequirementsList />
    </main>
  );
}
