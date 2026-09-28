import { Faculty } from "@/lib/mockData/faculties";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function FacultyView({ faculty }: { faculty: Faculty }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={faculty.name} description={`Dean: ${faculty.dean}`} />
        <DescriptionList
          items={[
            { label: "Address", value: faculty.address },
            { label: "Town", value: faculty.town },
            { label: "Region", value: faculty.region },
            { label: "Location", value: faculty.location },
            { label: "Phone", value: faculty.phone },
            { label: "Email", value: faculty.email },
            { label: "Status", value: faculty.status === "active" ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      <RowAction href={`/institution/faculty/${faculty.id}/edit`}>Edit</RowAction>
    </div>
  );
}
