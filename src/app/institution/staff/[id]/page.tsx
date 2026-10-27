import { requireRole } from "@/lib/auth/guard";
import { STAFF_PERMISSIONS, STAFF_PERMISSION_INFO, STAFF_ROLE_LABELS } from "@/lib/institution/staff";
import { formatDateTime } from "@/lib/utils";
import { NotFoundError } from "@/server/http/errors";
import { getStaff } from "@/server/modules/institutions/staff.service";
import { Card, CardHeader, DescriptionList, EmptyState, PageHeading, PAGE_MAIN_CLASS, RowAction } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  const s = await getStaff(user, id).catch((err) => (err instanceof NotFoundError ? null : Promise.reject(err)));
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Staff member")} />
      {!s ? (
        <EmptyState message={tr("This staff member doesn't exist, or belongs to another institution.")} />
      ) : (
        <div className="max-w-2xl space-y-4">
          <Card padded={false}>
            <CardHeader title={`${s.title ? `${s.title} ` : ""}${s.fullName}`} description={tr(s.position)} />
            <DescriptionList
              items={[
                { label: tr("Staff ID"), value: s.staffNo },
                { label: tr("Email"), value: s.email },
                { label: tr("Phone"), value: s.phone ?? "—" },
                { label: tr("Role"), value: tr(STAFF_ROLE_LABELS[s.role]) },
                { label: tr("Status"), value: s.status === "ACTIVE" ? tr("Active") : tr("Inactive") },
                { label: tr("Last signed in"), value: s.lastSignInAt ? formatDateTime(s.lastSignInAt) : tr("Never") },
                ...STAFF_PERMISSIONS.map((p) => ({ label: STAFF_PERMISSION_INFO[p].label, value: s.permissions.includes(p) ? tr("Yes") : tr("No") })),
              ]}
            />
          </Card>
          {user.role === "INSTITUTION_ADMIN" && <RowAction href={`/institution/staff/${s.id}/edit`}>{tr("Edit")}</RowAction>}
        </div>
      )}
    </main>
  );
}
