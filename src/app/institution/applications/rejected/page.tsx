import { requireRole } from "@/lib/auth/guard";
import ApplicationsTable from "@/components/institution/ApplicationsTable";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Rejected Applications" description="Applications your institution has rejected, with the reason given." />
      <ApplicationsTable fixedStatus="I_REJECTED" />
    </main>
  );
}
