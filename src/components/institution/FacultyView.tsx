import type { Faculty } from "@/lib/institution/types";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function FacultyView({ faculty, canEdit }: { faculty: Faculty; canEdit: boolean }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={faculty.name} description={faculty.dean ? `Dean: ${faculty.dean}` : undefined} />
        <DescriptionList
          items={[
            { label: "Code", value: faculty.code },
            { label: "Address", value: faculty.address },
            { label: "Phone", value: faculty.phone },
            { label: "Email", value: faculty.email },
            { label: "Status", value: faculty.status === "ACTIVE" ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/faculty/${faculty.id}/edit`}>Edit</RowAction>}
    </div>
  );
}
