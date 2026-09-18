import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import FacultyView from "@/components/institution/FacultyView";
import { mockFaculties } from "@/lib/mockData/faculties";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const faculty = mockFaculties.find((f) => f.id === params.id && f.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {faculty ? (
          // @ts-expect-error client component
          <FacultyView faculty={faculty} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Faculty not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
