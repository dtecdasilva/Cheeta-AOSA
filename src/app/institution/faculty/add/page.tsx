import { requireRole } from "@/lib/auth/guard";
import FacultyForm from "@/components/institution/FacultyForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  // Only an institution administrator can change the institution's records; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Add faculty")} description={tr("Add a faculty or school to your institution.")} />
      <FacultyForm />
    </main>
  );
}
