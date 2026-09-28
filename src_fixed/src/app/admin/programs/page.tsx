import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminProgramsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Qualifications / Study Programs" description="Manage qualifications and study programs." />
      <ComingSoonPanel title="Programs" note="Create and manage qualifications and programs here." />
    </main>
  );
}
