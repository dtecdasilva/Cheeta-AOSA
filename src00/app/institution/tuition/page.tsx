import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { TuitionList } from "@/components/tuition/Tuition";

export default async function InstitutionTuitionPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Tuition verification" description="Check the tuition payments your admitted students have recorded against your account statements." />
      <TuitionList basePath="/institution/tuition" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
