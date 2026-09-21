import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import { findStaffById } from "@/lib/mockData/staff";
import { Card, CardHeader, DescriptionList } from "@/components/ui";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const staff = findStaffById(params.id);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      {staff ? (
        <div className="space-y-4">
          <Card padded={true}>
            <CardHeader title={staff.name} description={staff.position} />
            <DescriptionList items={[{ label: "Staff ID", value: staff.staffId }, { label: "Role", value: staff.role }, { label: "Status", value: staff.status }]} />
          </Card>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-ink-soft)]">Staff not found.</p>
      )}
    </main>
  );
}
