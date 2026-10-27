import { requireRole } from "@/lib/auth/guard";
import ApplicationsTable from "@/components/institution/ApplicationsTable";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Acknowledged Applications")} description={tr("Applications your institution has acknowledged. They are on your deliberation list.")} />
      <ApplicationsTable fixedStatus="I_ACKNOWLEDGED" />
    </main>
  );
}
