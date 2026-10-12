import type { Department } from "@/lib/institution/types";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function DepartmentView({ department, facultyName, canEdit }: { department: Department; facultyName?: string; canEdit: boolean }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={department.name} description={department.head ? `Head: ${department.head}` : undefined} />
        <DescriptionList
          items={[
            { label: "Code", value: department.code },
            { label: "Faculty", value: facultyName },
            { label: "Phone", value: department.phone },
            { label: "Email", value: department.email },
            { label: "Status", value: department.status === "ACTIVE" ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/departments/${department.id}/edit`}>Edit</RowAction>}
    </div>
  );
}
