import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ReportsIndex } from "@/components/reports/Reports";

export default function AdminReportsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Reports" description="Search, filter and export every stage from registration to matriculation." />
      <ReportsIndex scope="admin" basePath="/admin/reports" />
    </main>
  );
}
