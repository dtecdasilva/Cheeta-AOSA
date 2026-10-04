import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ReportView } from "@/components/reports/Reports";
import { isReportKey, reportsFor } from "@/components/reports/keys";

export default async function InstitutionReportPage({ params }: { params: Promise<{ report: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { report } = await params;
  if (!isReportKey(report) || !reportsFor("institution").includes(report)) notFound();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ReportView reportKey={report} scope="institution" basePath="/institution/reports" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
