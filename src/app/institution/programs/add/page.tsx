import { requireRole } from "@/lib/auth/guard";
import ProgramForm from "@/components/institution/ProgramForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  // Only an institution administrator can change the institution's records; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add study program" description="Add a study program under a department, with its code and available spaces." />
      <ProgramForm />
    </main>
  );
}
