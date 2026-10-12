import { requireRole } from "@/lib/auth/guard";
import ApplicationsTable from "@/components/institution/ApplicationsTable";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Acknowledged Applications" description="Applications your institution has acknowledged. They are on your deliberation list." />
      <ApplicationsTable fixedStatus="I_ACKNOWLEDGED" />
    </main>
  );
}
