import { requireRole } from "@/lib/auth/guard";
import InstitutionDashboard from "@/components/institution/InstitutionDashboard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading
        title="Dashboard"
        description="Application volume and what currently needs your attention."
      />
      <InstitutionDashboard user={user} />
    </main>
  );
}
