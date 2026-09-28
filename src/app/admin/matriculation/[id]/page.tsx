import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { MatriculationDetail } from "@/components/matriculation/Matriculation";

export default async function AdminMatriculationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["AOSA_ADMIN"]);
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <MatriculationDetail
        accountId={decodeURIComponent(id)}
        basePath="/admin/matriculation"
        actor={{ name: user.fullName, role: user.role }}
        links={{ tuition: "/admin/tuition", medical: "/admin/medical", documents: "/admin/documents" }}
      />
    </main>
  );
}
