import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminDepartmentsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Departments" description="Manage departments." />
      <ComingSoonPanel title="Departments" note="Department management UI will be available here." />
    </main>
  );
}
