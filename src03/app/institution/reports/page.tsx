import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ReportsIndex } from "@/components/reports/Reports";

export default async function InstitutionReportsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Reports" description="Your institution's applications, admissions, payments and matriculation. Students awaiting payment approval show by first name only." />
      <ReportsIndex scope="institution" basePath="/institution/reports" institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
