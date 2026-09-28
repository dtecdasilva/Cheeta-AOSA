import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionTuitionList } from "@/components/tuition/InstitutionTuition";

export default async function InstitutionTuitionPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Tuition verification" description="Tuition for your admitted students. Identify paid students by the bank code AOSA issues, and mark each payment received." />
      <InstitutionTuitionList basePath="/institution/tuition" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
