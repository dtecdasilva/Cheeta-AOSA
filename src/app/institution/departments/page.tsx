import { requireRole } from "@/lib/auth/guard";
import DepartmentList from "@/components/institution/DepartmentList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Departments" description="Departments within your faculties and schools." />
      <DepartmentList />
    </main>
  );
}
