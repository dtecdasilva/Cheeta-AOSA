import { requireRole } from "@/lib/auth/guard";
import ApplicationsTable from "@/components/institution/ApplicationsTable";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Student Applications")} description={tr("Every application made to your institution. Filter by applicant, Application ID, date or status.")} />
      <ApplicationsTable initialStatus={(await searchParams).status} />
    </main>
  );
}
