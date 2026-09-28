import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { MedicalStudent } from "@/components/medical/Medical";

export default async function AdminMedicalStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["AOSA_ADMIN"]);
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <MedicalStudent accountId={decodeURIComponent(id)} basePath="/admin/medical" editor={{ name: user.fullName, role: user.role }} />
    </main>
  );
}
