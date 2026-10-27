import { requireRole } from "@/lib/auth/guard";
import StaffList from "@/components/institution/StaffList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Staff")} description={tr("Your institution's administrators and admission users, and what each may do.")} />
      <StaffList />
    </main>
  );
}
