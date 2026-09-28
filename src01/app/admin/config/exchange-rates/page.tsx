import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminConfigExchangeRatesPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Exchange rates" description="Manage exchange rates used across the platform." />
      <ComingSoonPanel title="Exchange rates" note="Exchange rate management will be available here." />
    </main>
  );
}
