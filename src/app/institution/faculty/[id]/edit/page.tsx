import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../InstitutionShell";
import FacultyForm from "@/components/institution/FacultyForm";
import { mockFaculties } from "@/lib/mockData/faculties";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const faculty = mockFaculties.find((f) => f.id === params.id && f.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Edit faculty</h1>
        {faculty ? (
          // @ts-expect-error client component
          <FacultyForm institutionId={user.institutionId ?? "inst-1"} initial={faculty} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Faculty not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
