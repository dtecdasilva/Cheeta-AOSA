import { requireRole } from "@/lib/auth/guard";
import ApplicationsTable from "@/components/institution/ApplicationsTable";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Student Applications" description="Every application made to your institution. Filter by applicant, Application ID, date or status." />
      <ApplicationsTable />
    </main>
  );
}
