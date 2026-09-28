import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminPaymentConfigPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Payment configuration" description="Configure payment settings." />
      <ComingSoonPanel title="Payment configuration" note="Gateway configs and fees will be managed here." />
    </main>
  );
}
