import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../InstitutionShell";
import UploadRequirementView from "@/components/institution/UploadRequirementView";
import { mockUploadRequirements } from "@/lib/mockData/uploadRequirements";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const req = mockUploadRequirements.find((r) => r.id === params.id && r.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {req ? (
          // @ts-expect-error client
          <UploadRequirementView req={req} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Requirement not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../../InstitutionShell";
import UploadRequirementView from "@/components/institution/UploadRequirementView";
import { mockUploadRequirements } from "@/lib/mockData/uploadRequirements";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const req = mockUploadRequirements.find((r) => r.id === params.id && r.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {req ? (
          // @ts-expect-error client
          <UploadRequirementView req={req} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Requirement not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
