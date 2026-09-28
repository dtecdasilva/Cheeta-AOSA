import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { MedicalStudent } from "@/components/medical/Medical";

export default async function InstitutionMedicalStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <MedicalStudent accountId={decodeURIComponent(id)} basePath="/institution/medical" institutionId={resolveInstitutionId(user)} editor={{ name: user.fullName, role: user.role }} />
    </main>
  );
}
