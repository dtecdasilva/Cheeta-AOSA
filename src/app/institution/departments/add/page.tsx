import { requireRole } from "@/lib/auth/guard";
import DepartmentForm from "@/components/institution/DepartmentForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  // Only an institution administrator can change the institution's records; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Add department")} description={tr("Add a department under one of your faculties.")} />
      <DepartmentForm />
    </main>
  );
}
