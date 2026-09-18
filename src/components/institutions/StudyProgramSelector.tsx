"use client";

import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { SelectInput } from "@/components/Form";
import { InstitutionWithProfile, ProgramChoice } from "@/lib/institutionDiscovery/data";

const RANK_LABELS: Record<number, string> = { 1: "First Choice", 2: "Second Choice", 3: "Third Choice" };

// Frontend-only, mock data, per spec: choices live in the parent's
// component state (lifted up so they survive navigating back to browse
// and returning) — nothing here calls an API or validates server-side.
// "Do not implement backend validation yet" means duplicate/completeness
// checks below are UI conveniences only, not an enforced rule.
export function StudyProgramSelector({
  institution,
  choices,
  onChange,
  onBack,
}: {
  institution: InstitutionWithProfile;
  choices: (ProgramChoice | null)[];
  onChange: (choices: (ProgramChoice | null)[]) => void;
  onBack: () => void;
}) {
  const slots = institution.maxProgramChoices;
  const chosenProgramIds = choices.filter((c): c is ProgramChoice => !!c).map((c) => c.programId);

  function updateSlot(index: number, patch: Partial<ProgramChoice> | null) {
    const next = [...choices];
    if (patch === null) {
      next[index] = null;
    } else {
      next[index] = { ...(next[index] as ProgramChoice), rank: index + 1, ...patch } as ProgramChoice;
    }
    onChange(next);
  }

  function handleFacultyChange(index: number, facultyId: string) {
    const faculty = institution.profile.faculties.find((f) => f.id === facultyId);
    if (!faculty) {
      updateSlot(index, null);
      return;
    }
    updateSlot(index, {
      facultyId: faculty.id,
      facultyName: faculty.name,
      departmentId: "",
      departmentName: "",
      qualification: "",
      programId: "",
      programName: "",
      availableSpaces: 0,
    });
  }

  function handleDepartmentChange(index: number, departmentId: string) {
    const current = choices[index];
    const faculty = institution.profile.faculties.find((f) => f.id === current?.facultyId);
    const dept = faculty?.departments.find((d) => d.id === departmentId);
    if (!current || !dept) return;
    updateSlot(index, {
      ...current,
      departmentId: dept.id,
      departmentName: dept.name,
      qualification: "",
      programId: "",
      programName: "",
      availableSpaces: 0,
    });
  }

  function handleQualificationChange(index: number, qualification: string) {
    const current = choices[index];
    if (!current) return;
    updateSlot(index, { ...current, qualification, programId: "", programName: "", availableSpaces: 0 });
  }

  function handleProgramChange(index: number, programId: string) {
    const current = choices[index];
    const faculty = institution.profile.faculties.find((f) => f.id === current?.facultyId);
    const dept = faculty?.departments.find((d) => d.id === current?.departmentId);
    const program = dept?.programs.find((p) => p.id === programId);
    if (!current || !program) return;
    updateSlot(index, {
      ...current,
      programId: program.id,
      programName: program.name,
      availableSpaces: program.availableSpaces,
    });
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back
      </button>

      <div className="mb-5 border border-[var(--color-line)] bg-white p-5">
        <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">{institution.name}</p>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Choose {slots === 1 ? "your study program" : `up to ${slots} study programs, in order of preference`} for
          this institution.
        </p>
      </div>

      <div className="space-y-4">
        {Array.from({ length: slots }, (_, index) => {
          const choice = choices[index];
          const faculty = institution.profile.faculties.find((f) => f.id === choice?.facultyId);
          const department = faculty?.departments.find((d) => d.id === choice?.departmentId);
          const qualificationOptions = department
            ? Array.from(new Set(department.programs.map((p) => p.qualification)))
            : [];
          const programOptions = department
            ? department.programs.filter(
                (p) =>
                  p.qualification === choice?.qualification &&
                  (!chosenProgramIds.includes(p.id) || p.id === choice?.programId)
              )
            : [];

          return (
            <div key={index} className="border border-[var(--color-line)] bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">
                  {RANK_LABELS[index + 1] ?? `Choice ${index + 1}`}
                </p>
                {choice?.programId && (
                  <span className="flex items-center gap-1.5 border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-2 py-1 text-xs font-medium text-[var(--color-success)]">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Selected
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm text-[var(--color-ink-soft)]">Faculty / School</label>
                  <SelectInput value={choice?.facultyId ?? ""} onChange={(e) => handleFacultyChange(index, e.target.value)}>
                    <option value="">Select…</option>
                    {institution.profile.faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </SelectInput>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[var(--color-ink-soft)]">Department</label>
                  <SelectInput
                    value={choice?.departmentId ?? ""}
                    onChange={(e) => handleDepartmentChange(index, e.target.value)}
                    disabled={!faculty}
                  >
                    <option value="">Select…</option>
                    {faculty?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </SelectInput>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[var(--color-ink-soft)]">Qualification</label>
                  <SelectInput
                    value={choice?.qualification ?? ""}
                    onChange={(e) => handleQualificationChange(index, e.target.value)}
                    disabled={!department}
                  >
                    <option value="">Select…</option>
                    {qualificationOptions.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </SelectInput>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[var(--color-ink-soft)]">Study program</label>
                  <SelectInput
                    value={choice?.programId ?? ""}
                    onChange={(e) => handleProgramChange(index, e.target.value)}
                    disabled={!choice?.qualification}
                  >
                    <option value="">Select…</option>
                    {programOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              {choice?.programId && (
                <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                  Available spaces:{" "}
                  {choice.availableSpaces > 0 ? (
                    <span className="font-medium text-[var(--color-ink)]">{choice.availableSpaces}</span>
                  ) : (
                    <span className="font-medium text-[var(--color-danger)]">Full</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
