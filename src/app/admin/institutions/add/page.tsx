import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionFormScreen } from "@/components/admin/institutions/InstitutionForm";

export default function AdminAddInstitutionPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add institution" description="Register a new institution on the platform." />
      <InstitutionFormScreen />
    </main>
  );
}
