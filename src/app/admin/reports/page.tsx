import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ReportsIndex } from "@/components/reports/Reports";
import { getT } from "@/lib/i18n/server";

export default async function AdminReportsPage() {
  const tr = await getT();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Reports")} description={tr("Search, filter and export every stage from registration to matriculation.")} />
      <ReportsIndex scope="admin" basePath="/admin/reports" />
    </main>
  );
}
