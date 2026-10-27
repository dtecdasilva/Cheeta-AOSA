import { requireRole } from "@/lib/auth/guard";
import FacultyList from "@/components/institution/FacultyList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Faculty / School")} description={tr("Faculties and schools that make up your institution.")} />
      <FacultyList />
    </main>
  );
}
