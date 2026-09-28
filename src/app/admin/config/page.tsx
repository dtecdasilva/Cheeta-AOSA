import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminConfigPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="System configuration" description="Platform-wide configuration parameters." />
      <ComingSoonPanel title="System configuration" note="System parameters and settings will be handled here." />
    </main>
  );
}
