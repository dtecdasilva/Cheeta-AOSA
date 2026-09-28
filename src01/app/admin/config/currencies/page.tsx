import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminConfigCurrenciesPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Currencies" description="Manage currencies supported by the platform." />
      <ComingSoonPanel title="Currencies" note="Currency list and settings will be available here." />
    </main>
  );
}
