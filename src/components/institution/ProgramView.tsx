"use client";

import { StudyProgramDef } from "@/lib/mockData/programs";
import { mockFaculties } from "@/lib/mockData/faculties";
import { mockDepartments } from "@/lib/mockData/departments";
import { mockQualifications } from "@/lib/mockData/qualifications";

export default function ProgramView({ program }: { program: StudyProgramDef }) {
  const faculty = mockFaculties.find((f) => f.id === program.facultyId);
  const department = mockDepartments.find((d) => d.id === program.departmentId);
  const qualification = mockQualifications.find((q) => q.id === program.qualificationId);

  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">{program.name} <span className="text-xs text-[var(--color-ink-soft)]">({program.code})</span></h2>
        <p className="text-sm text-[var(--color-ink-soft)]">Qualification: {qualification?.name}</p>
      </div>

      <div className="rounded border border-[var(--color-line)] bg-white p-4 space-y-2">
        <p><strong>Faculty:</strong> {faculty?.name}</p>
        <p><strong>Department:</strong> {department?.name}</p>
        <p><strong>Available spaces:</strong> {program.availableSpaces}</p>
        <p><strong>Status:</strong> {program.status}</p>
      </div>
    </div>
  );
}
