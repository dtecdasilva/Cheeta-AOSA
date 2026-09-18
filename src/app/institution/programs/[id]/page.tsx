import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import ProgramView from "@/components/institution/ProgramView";
import { mockPrograms } from "@/lib/mockData/programs";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const prog = mockPrograms.find((p) => p.id === params.id && p.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {prog ? (
          // @ts-expect-error client
          <ProgramView program={prog} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Program not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
