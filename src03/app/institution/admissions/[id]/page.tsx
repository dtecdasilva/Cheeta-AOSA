import { requireRole } from "@/lib/auth/guard";
import { findAdmissionById } from "@/lib/mockData/admissions";
import AdmissionDetail from "@/components/institution/AdmissionDetail";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const admission = findAdmissionById(params.id);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">Admission detail</h1>
      <AdmissionDetail admission={admission as any} />
    </main>
  );
}
