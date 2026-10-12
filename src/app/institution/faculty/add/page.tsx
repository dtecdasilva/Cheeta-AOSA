import { requireRole } from "@/lib/auth/guard";
import FacultyForm from "@/components/institution/FacultyForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  // Only an institution administrator can change the institution's records; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add faculty" description="Add a faculty or school to your institution." />
      <FacultyForm />
    </main>
  );
}
