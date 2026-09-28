import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { MatriculationList } from "@/components/matriculation/Matriculation";

export default async function InstitutionMatriculationPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Matriculation" description="Confirm matriculation for admitted students who have accepted their offer, cleared tuition and passed medical verification." />
      <MatriculationList basePath="/institution/matriculation" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
