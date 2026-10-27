import { requireRole } from "@/lib/auth/guard";
import ProgramList from "@/components/institution/ProgramList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Study Programs")} description={tr("Programmes applicants can choose when applying to your institution.")} />
      <ProgramList />
    </main>
  );
}
