import type { Faculty } from "@/lib/institution/types";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { placeNames } from "@/server/modules/reference/placeNames";

export default async function FacultyView({ faculty, canEdit }: { faculty: Faculty; canEdit: boolean }) {
  const tr = await getT();
  const place = await placeNames(faculty.regionId, faculty.townId);
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={tr(faculty.name)} description={faculty.dean ? `Dean: ${faculty.dean}` : undefined} />
        <DescriptionList
          items={[
            { label: tr("Code"), value: faculty.code },
            { label: tr("Address"), value: faculty.address },
            { label: tr("Location"), value: faculty.location },
            { label: tr("Region"), value: place.region },
            { label: tr("Town"), value: place.town },
            { label: tr("Phone"), value: faculty.phone },
            { label: tr("Email"), value: faculty.email },
            { label: tr("Status"), value: faculty.status === "ACTIVE" ? tr("Active") : tr("Inactive") },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/faculty/${faculty.id}/edit`}>{tr("Edit")}</RowAction>}
    </div>
  );
}
