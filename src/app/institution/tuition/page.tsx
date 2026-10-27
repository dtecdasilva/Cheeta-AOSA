import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionTuitionList } from "@/components/tuition/InstitutionTuition";
import { getT } from "@/lib/i18n/server";

export default async function InstitutionTuitionPage() {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Tuition verification")} description={tr("Tuition for your admitted students. Identify paid students by the bank code AOSA issues, and mark each payment received.")} />
      <InstitutionTuitionList basePath="/institution/tuition" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
