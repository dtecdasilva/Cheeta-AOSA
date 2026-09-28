import { Department } from "@/lib/mockData/departments";
import { mockFaculties } from "@/lib/mockData/faculties";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function DepartmentView({ department }: { department: Department }) {
  const faculty = mockFaculties.find((f) => f.id === department.facultyId);
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={department.name} description={`Head: ${department.head}`} />
        <DescriptionList
          items={[
            { label: "Faculty", value: faculty?.name },
            { label: "Address", value: department.address },
            { label: "Town", value: department.town },
            { label: "Region", value: department.region },
            { label: "Location", value: department.location },
            { label: "Phone", value: department.phone },
            { label: "Email", value: department.email },
            { label: "Status", value: department.status === "active" ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      <RowAction href={`/institution/departments/${department.id}/edit`}>Edit</RowAction>
    </div>
  );
}
