import { LANGUAGE_LABELS, STUDY_MODE_LABELS, type Program } from "@/lib/institution/types";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function ProgramView({
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
  const tr = await getT();
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={tr(program.name)} description={program.code} />
        <DescriptionList
          items={[
            { label: tr("Faculty"), value: facultyName },
            { label: tr("Department"), value: departmentName },
            { label: tr("Qualification"), value: qualificationName },
            { label: tr("Duration"), value: `${program.durationYears} year${program.durationYears === 1 ? "" : "s"}` },
            { label: tr("Study mode"), value: tr(STUDY_MODE_LABELS[program.studyMode]) },
            { label: tr("Language"), value: tr(LANGUAGE_LABELS[program.language]) },
            { label: tr("Available spaces"), value: program.availableSpaces },
            { label: tr("Status"), value: program.status === "ACTIVE" ? tr("Active") : tr("Inactive") },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/programs/${program.id}/edit`}>{tr("Edit")}</RowAction>}
    </div>
  );
}
