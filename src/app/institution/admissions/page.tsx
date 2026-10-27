import { requireRole } from "@/lib/auth/guard";
import AdmissionsTable from "@/components/institution/AdmissionsTable";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">{tr("Admissions")}</h1>
      <AdmissionsTable initialStatus={(await searchParams).status} />
    </main>
  );
}
