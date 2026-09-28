import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminConfigCountriesPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Countries" description="Manage country list and metadata." />
      <ComingSoonPanel title="Countries" note="Country data management will be available here." />
    </main>
  );
}
