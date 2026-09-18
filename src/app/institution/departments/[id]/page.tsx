import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import DepartmentView from "@/components/institution/DepartmentView";
import { mockDepartments } from "@/lib/mockData/departments";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const dep = mockDepartments.find((d) => d.id === params.id && d.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {dep ? (
          <DepartmentView department={dep} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Department not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
