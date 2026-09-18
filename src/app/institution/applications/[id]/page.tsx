import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import ApplicationDetail from "@/components/institution/ApplicationDetail";
import { findApplicationById } from "@/lib/mockData/applications";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const app = findApplicationById(params.id);
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {app ? (
          <ApplicationDetail application={app} institutionId={user.institutionId ?? "inst-1"} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Application not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
