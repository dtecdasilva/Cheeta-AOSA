import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionFormScreen } from "@/components/admin/institutions/InstitutionForm";
import { getT } from "@/lib/i18n/server";

export default async function AdminAddInstitutionPage() {
  const tr = await getT();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Add institution")} description={tr("Register a new institution on the platform.")} />
      <InstitutionFormScreen />
    </main>
  );
}
