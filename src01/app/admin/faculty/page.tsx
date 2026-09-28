import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminFacultyPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Faculty / School" description="Manage faculties and schools." />
      <ComingSoonPanel title="Faculty management" note="Create and manage faculties and schools here." />
    </main>
  );
}
