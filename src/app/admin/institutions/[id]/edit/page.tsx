import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionFormScreen } from "@/components/admin/institutions/InstitutionForm";
import { getT } from "@/lib/i18n/server";

export default async function AdminEditInstitutionPage({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Edit institution")} description={tr("Update the institution's details. Changes apply immediately.")} />
      <InstitutionFormScreen id={decodeURIComponent(id)} />
    </main>
  );
}
