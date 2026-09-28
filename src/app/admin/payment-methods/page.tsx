import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminPaymentMethodsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Institution payment methods" description="Configure payment methods available to institutions." />
      <ComingSoonPanel title="Payment methods" note="Payment methods and connectors will be managed here." />
    </main>
  );
}
