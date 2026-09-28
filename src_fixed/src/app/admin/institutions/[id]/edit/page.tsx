import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionFormScreen } from "@/components/admin/institutions/InstitutionForm";

export default async function AdminEditInstitutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Edit institution" description="Update the institution's details. Changes apply immediately." />
      <InstitutionFormScreen id={decodeURIComponent(id)} />
    </main>
  );
}
