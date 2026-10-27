import type { Department } from "@/lib/institution/types";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { placeNames } from "@/server/modules/reference/placeNames";

export default async function DepartmentView({ department, facultyName, canEdit }: { department: Department; facultyName?: string; canEdit: boolean }) {
  const tr = await getT();
  const place = await placeNames(department.regionId, department.townId);
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={tr(department.name)} description={department.head ? `Head: ${department.head}` : undefined} />
        <DescriptionList
          items={[
            { label: tr("Code"), value: department.code },
            { label: tr("Faculty"), value: facultyName },
            { label: tr("Address"), value: department.address },
            { label: tr("Location"), value: department.location },
            { label: tr("Region"), value: place.region },
            { label: tr("Town"), value: place.town },
            { label: tr("Phone"), value: department.phone },
            { label: tr("Email"), value: department.email },
            { label: tr("Status"), value: department.status === "ACTIVE" ? tr("Active") : tr("Inactive") },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/departments/${department.id}/edit`}>{tr("Edit")}</RowAction>}
    </div>
  );
}
