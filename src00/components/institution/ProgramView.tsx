import { StudyProgramDef } from "@/lib/mockData/programs";
import { mockFaculties } from "@/lib/mockData/faculties";
import { mockDepartments } from "@/lib/mockData/departments";
import { mockQualifications } from "@/lib/mockData/qualifications";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function ProgramView({ program }: { program: StudyProgramDef }) {
  const faculty = mockFaculties.find((f) => f.id === program.facultyId);
  const department = mockDepartments.find((d) => d.id === program.departmentId);
  const qualification = mockQualifications.find((q) => q.id === program.qualificationId);

  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={program.name} description={program.code} />
        <DescriptionList
          items={[
            { label: "Qualification", value: qualification?.name },
            { label: "Faculty", value: faculty?.name },
            { label: "Department", value: department?.name },
            { label: "Available spaces", value: program.availableSpaces },
            { label: "Status", value: program.status === "active" ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      <RowAction href={`/institution/programs/${program.id}/edit`}>Edit</RowAction>
    </div>
  );
}
