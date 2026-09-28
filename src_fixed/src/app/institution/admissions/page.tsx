import { requireRole } from "@/lib/auth/guard";
import AdmissionsTable from "@/components/institution/AdmissionsTable";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-[var(--font-display)] text-xl mb-4">Admissions</h1>
      <AdmissionsTable institutionId={user.institutionId ?? "inst-1"} />
    </main>
  );
}
