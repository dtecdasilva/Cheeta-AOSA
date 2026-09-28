import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { MedicalList } from "@/components/medical/Medical";

export default async function InstitutionMedicalPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Medical verification" description="Your admitted students' medical requirements. Every requirement must be verified before matriculation." />
      <MedicalList basePath="/institution/medical" institutionId={resolveInstitutionId(user)} editor={{ name: user.fullName, role: user.role }} />
    </main>
  );
}
