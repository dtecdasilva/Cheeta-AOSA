import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import ApplicationDetail from "@/components/institution/ApplicationDetail";
import { findApplicationById } from "@/lib/mockData/applications";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  const institutionId = resolveInstitutionId(user);

  // An application is only visible here if it was actually sent to this
  // institution — otherwise one institution could read another's intake
  // simply by guessing an application id.
  const application = findApplicationById(id);
  const visible = application?.institutionIds.includes(institutionId) ? application : null;

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Application" description={visible ? visible.id : undefined} />
      {visible ? (
        <ApplicationDetail application={visible} institutionId={institutionId} />
      ) : (
        <EmptyState message="This application doesn't exist, or wasn't submitted to your institution." />
      )}
    </main>
  );
}
