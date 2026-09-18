import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../../InstitutionShell";
import UploadRequirementForm from "@/components/institution/UploadRequirementForm";
import { mockUploadRequirements } from "@/lib/mockData/uploadRequirements";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const req = mockUploadRequirements.find((r) => r.id === params.id && r.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Edit upload requirement</h1>
        {req ? (
          <UploadRequirementForm institutionId={user.institutionId ?? "inst-1"} initial={req} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Requirement not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
