import { requireRole } from "@/lib/auth/guard";
import InstitutionDashboard from "@/components/institution/InstitutionDashboard";
import { ApplicationWindowCard } from "@/components/institution/ApplicationWindowCard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading
        title={tr("Dashboard")}
        description={tr("Application volume and what currently needs your attention.")}
      />
      <ApplicationWindowCard canEdit={user.role === "INSTITUTION_ADMIN"} />
      <InstitutionDashboard user={user} />
    </main>
  );
}
