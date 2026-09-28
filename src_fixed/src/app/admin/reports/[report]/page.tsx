import { notFound } from "next/navigation";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ReportView } from "@/components/reports/Reports";
import { isReportKey } from "@/components/reports/keys";

export default async function AdminReportPage({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!isReportKey(report)) notFound();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ReportView reportKey={report} scope="admin" basePath="/admin/reports" />
    </main>
  );
}
