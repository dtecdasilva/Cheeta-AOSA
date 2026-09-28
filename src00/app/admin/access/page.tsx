import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminAccessPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Access management" description="Manage platform access and roles." />
      <ComingSoonPanel title="Access management" note="User and role management UI will be available here." />
    </main>
  );
}
