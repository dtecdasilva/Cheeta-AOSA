import { LANGUAGE_LABELS, STUDY_MODE_LABELS, type Program } from "@/lib/institution/types";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function ProgramView({
  program,
  facultyName,
  departmentName,
  qualificationName,
  canEdit,
}: {
  program: Program;
  facultyName?: string;
  departmentName?: string;
  qualificationName?: string;
  canEdit: boolean;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={program.name} description={program.code} />
        <DescriptionList
          items={[
            { label: "Faculty", value: facultyName },
            { label: "Department", value: departmentName },
            { label: "Qualification", value: qualificationName },
            { label: "Duration", value: `${program.durationYears} year${program.durationYears === 1 ? "" : "s"}` },
            { label: "Study mode", value: STUDY_MODE_LABELS[program.studyMode] },
            { label: "Language", value: LANGUAGE_LABELS[program.language] },
            { label: "Available spaces", value: program.availableSpaces },
            { label: "Status", value: program.status === "ACTIVE" ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/programs/${program.id}/edit`}>Edit</RowAction>}
    </div>
  );
}
