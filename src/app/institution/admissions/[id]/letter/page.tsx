import { requireRole } from "@/lib/auth/guard";
import AdmissionLetter from "@/components/institution/AdmissionLetter";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">{tr("Admission letter")}</h1>
      <AdmissionLetter id={id} />
    </main>
  );
}
