import { requireRole } from "@/lib/auth/guard";
import { findAdmissionById } from "@/lib/mockData/admissions";
import { findApplicationById } from "@/lib/mockData/applications";
import AdmissionLetter from "@/components/institution/AdmissionLetter";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const admission = findAdmissionById(params.id);
  const application = admission ? findApplicationById(admission.applicationId) : null;

  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-[var(--font-display)] text-xl mb-4">Admission letter</h1>
      {/* @ts-expect-error server -> client */}
      <AdmissionLetter admission={admission as any} application={application as any} institution={{ name: user.institutionName, location: "" }} />
    </main>
  );
}
