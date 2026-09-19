import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import ProgramList from "@/components/institution/ProgramList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Study Programs" description="Programmes applicants can choose when applying to your institution." />
      <ProgramList institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
