import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ReportsIndex } from "@/components/reports/Reports";
import { getT } from "@/lib/i18n/server";

export default async function InstitutionReportsPage() {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Reports")} description={tr("Your institution's applications, admissions, payments and matriculation. Students awaiting payment approval show by first name only.")} />
      <ReportsIndex scope="institution" basePath="/institution/reports" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
