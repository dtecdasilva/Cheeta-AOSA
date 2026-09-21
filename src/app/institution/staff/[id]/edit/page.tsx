import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../InstitutionShell";
import StaffForm from "@/components/institution/StaffForm";
import { findStaffById } from "@/lib/mockData/staff";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const staff = findStaffById(params.id);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="mb-4 text-xl font-semibold">Edit staff member</h1>
      {staff ? (
        <StaffForm institutionId={user.institutionId ?? "inst-1"} initial={staff} />
      ) : (
        <p className="text-sm text-[var(--color-ink-soft)]">Staff not found.</p>
      )}
    </main>
  );
}
