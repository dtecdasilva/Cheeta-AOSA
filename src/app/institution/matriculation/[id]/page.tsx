import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { MatriculationDetail } from "@/components/matriculation/Matriculation";

export default async function InstitutionMatriculationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <MatriculationDetail
        accountId={decodeURIComponent(id)}
        basePath="/institution/matriculation"
        institutionId={resolveInstitutionId(user)}
        actor={{ name: user.fullName, role: user.role }}
        links={{ tuition: "/institution/tuition", medical: "/institution/medical", documents: "/institution/documents" }}
      />
    </main>
  );
}
