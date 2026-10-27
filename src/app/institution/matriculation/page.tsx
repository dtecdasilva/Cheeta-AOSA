import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { MatriculationList } from "@/components/matriculation/Matriculation";
import { getT } from "@/lib/i18n/server";

export default async function InstitutionMatriculationPage() {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Matriculation")} description={tr("Confirm matriculation for admitted students who have accepted their offer, cleared tuition and passed medical verification.")} />
      <MatriculationList basePath="/institution/matriculation" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
