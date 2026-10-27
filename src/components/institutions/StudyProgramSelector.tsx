"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput } from "@/components/Form";
import { choiceFor, type InstitutionDetails, type ProgramChoice } from "@/lib/institutionDiscovery/data";
import type { Outcome } from "@/lib/applications/api";
import { useT } from "@/lib/i18n/client";

const RANK_LABELS: Record<number, string> = { 1: "First Choice", 2: "Second Choice", 3: "Third Choice" };

/**
 * The applicant's ranked study-program choices at one institution they
 * have added. The slots start from the choices already saved and are
 * sent to the server with Save (`onSave`), which checks them: programs
 * the institution currently offers, each once, ranked without gaps, and
 * no more than the institution allows. Nothing is kept until it is saved.
 */
export function StudyProgramSelector({
  institution,
  saved,
  editable,
  onSave,
  onBack,
}: {
  institution: InstitutionDetails;
  /** Program ids already saved, in order of preference. */
  saved: string[];
  /** False once the application has been submitted: the choices are shown, not changed. */
  editable: boolean;
  onSave: (programIds: string[]) => Promise<Outcome>;
  onBack: () => void;
}) {
  const tr = useT();
  const slots = institution.maxProgramChoices;
  const [choices, setChoices] = useState<(ProgramChoice | null)[]>(() => Array.from({ length: slots }, (_, i) => (saved[i] ? (choiceFor(institution, saved[i], i + 1) ?? null) : null)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNow, setSavedNow] = useState(false);
  const chosenProgramIds = choices.filter((c): c is ProgramChoice => !!c).map((c) => c.programId);

  function onChange(next: (ProgramChoice | null)[]) {
    setChoices(next);
    setSavedNow(false);
    setError(null);
  }

  function updateSlot(index: number, patch: Partial<ProgramChoice> | null) {
    const next = [...choices];
    if (patch === null) {
      next[index] = null;
    } else {
      next[index] = { ...(next[index] as ProgramChoice), rank: index + 1, ...patch } as ProgramChoice;
    }
    onChange(next);
  }

  async function save() {
    if (saving) return;
    // A slot with a faculty picked but no program yet isn't a choice.
    const filled = choices.map((c) => (c?.programId ? c.programId : null));
    const lastFilled = filled.reduce((last, id, i) => (id ? i : last), -1);
    if (filled.slice(0, lastFilled + 1).some((id) => !id)) {
      setError(tr("Fill in your {toLowerCase} before the ones after it.", { toLowerCase: RANK_LABELS[filled.indexOf(null) + 1].toLowerCase() }));
      return;
    }
    setSaving(true);
    const result = await onSave(filled.filter((id): id is string => !!id));
    setSaving(false);
    if (result.ok) setSavedNow(true);
    else setError(result.error);
  }

  function handleFacultyChange(index: number, facultyId: string) {
    const faculty = institution.faculties.find((f) => f.id === facultyId);
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
    const faculty = institution.faculties.find((f) => f.id === current?.facultyId);
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
    const faculty = institution.faculties.find((f) => f.id === current?.facultyId);
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
        {tr("Back")}
      </button>

      <div className="mb-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr(institution.name)}</p>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {tr("Choose")}{" "}{slots === 1 ? tr("your study program") : tr("up to {slots} study programs, in order of preference", { slots })}{" "}{tr("for this institution.")}
        </p>
      </div>

      {!editable && (
        <p className="mb-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
          {tr("This application has been submitted, so its program choices can no longer be changed here.")}
        </p>
      )}
      {institution.faculties.length === 0 && (
        <p className="mb-4 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning-strong)]">
          {tr("This institution hasn't published its study programs yet, so there is nothing to choose.")}
        </p>
      )}

      <fieldset disabled={!editable} className="space-y-4">
        {Array.from({ length: slots }, (_, index) => {
          const choice = choices[index];
          const faculty = institution.faculties.find((f) => f.id === choice?.facultyId);
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
            <div key={index} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold text-base text-[var(--color-ink)]">
                  {RANK_LABELS[index + 1] ?? tr("Choice {value}", { value: index + 1 })}
                </p>
                {choice && editable && (
                  <button type="button" onClick={() => updateSlot(index, null)} className="ml-auto mr-3 text-xs font-medium text-[var(--color-ink-soft)] underline underline-offset-4">
                    {tr("Clear")}
                  </button>
                )}
                {choice?.programId && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-2 py-1 text-xs font-medium text-[var(--color-success-strong)]">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    {tr("Selected")}
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={tr("Faculty / School")}>
                  <SelectInput value={choice?.facultyId ?? ""} onChange={(e) => handleFacultyChange(index, e.target.value)}>
                    <option value="">{tr("Select…")}</option>
                    {institution.faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {tr(f.name)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label={tr("Department")}>
                  <SelectInput
                    value={choice?.departmentId ?? ""}
                    onChange={(e) => handleDepartmentChange(index, e.target.value)}
                    disabled={!faculty}
                  >
                    <option value="">{tr("Select…")}</option>
                    {faculty?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {tr(d.name)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label={tr("Qualification")}>
                  <SelectInput
                    value={choice?.qualification ?? ""}
                    onChange={(e) => handleQualificationChange(index, e.target.value)}
                    disabled={!department}
                  >
                    <option value="">{tr("Select…")}</option>
                    {qualificationOptions.map((q) => (
                      <option key={q} value={q}>
                        {tr(q)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label={tr("Study program")}>
                  <SelectInput
                    value={choice?.programId ?? ""}
                    onChange={(e) => handleProgramChange(index, e.target.value)}
                    disabled={!choice?.qualification}
                  >
                    <option value="">{tr("Select…")}</option>
                    {programOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {tr(p.name)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>

              {choice?.programId && (
                <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                  {tr("Available spaces:")}{" "}
                  {choice.availableSpaces > 0 ? (
                    <span className="font-medium text-[var(--color-ink)]">{tr(choice.availableSpaces)}</span>
                  ) : (
                    <span className="font-medium text-[var(--color-danger)]">{tr("Full")}</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </fieldset>

      {error && (
        <div className="mt-4">
          <FormError>{tr(error)}</FormError>
        </div>
      )}
      {savedNow && (
        <p role="status" className="mt-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {tr("Your program choices for {name} are saved.", { name: tr(institution.name) })}
        </p>
      )}
      <div className="mt-5 flex items-center gap-2">
        {editable && (
          <PrimaryButton type="button" onClick={save} disabled={saving}>
            {saving ? tr("Saving…") : tr("Save choices")}
          </PrimaryButton>
        )}
        <SecondaryButton type="button" onClick={onBack}>
          {savedNow || !editable ? tr("Done") : tr("Cancel")}
        </SecondaryButton>
      </div>
    </div>
  );
}
