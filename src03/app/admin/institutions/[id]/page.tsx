import { PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionView } from "@/components/admin/institutions/InstitutionView";

export default async function AdminInstitutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <InstitutionView id={decodeURIComponent(id)} />
    </main>
  );
}
