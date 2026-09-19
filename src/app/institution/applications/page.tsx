import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import ApplicationsTable from "@/components/institution/ApplicationsTable";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading
        title="Student Applications"
        description="Every application submitted to your institution. Filter by applicant, reference, date or status."
      />
      <ApplicationsTable institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
