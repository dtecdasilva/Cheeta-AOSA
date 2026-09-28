import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionTuitionAccount } from "@/components/tuition/InstitutionTuition";

export default async function InstitutionTuitionAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <InstitutionTuitionAccount id={decodeURIComponent(id)} basePath="/institution/tuition" institutionId={resolveInstitutionId(user)} staffName={user.fullName} />
    </main>
  );
}
