import { requireRole } from "@/lib/auth/guard";
import FacultyList from "@/components/institution/FacultyList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Faculty / School" description="Faculties and schools that make up your institution." />
      <FacultyList />
    </main>
  );
}
