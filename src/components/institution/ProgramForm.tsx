"use client";

import { useEffect, useState } from "react";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { useOptions } from "@/lib/institution/api";
import { LANGUAGE_LABELS, STUDY_MODE_LABELS, type Department, type Faculty, type Program, type StudyMode, type TeachingLanguage } from "@/lib/institution/types";
import { useRecordForm } from "./useRecordForm";
import { useT } from "@/lib/i18n/client";

/**
 * Adds a study program, or edits one. A program sits under a department
 * of a faculty and leads to a qualification; the server checks that the
 * department really is in the faculty chosen. Saved through
 * /api/institution/programs.
 *
 * `duplicateOf` starts a NEW program from a copy of an existing one: every
 * field is carried over, but it is saved as a new record, so it needs a
 * code of its own.
 */
export default function ProgramForm({ initial, duplicateOf }: { initial?: Program; duplicateOf?: Program }) {
  const tr = useT();
  const faculties = useOptions<Faculty>("/api/institution/faculties?pageSize=200");
  const departments = useOptions<Department>("/api/institution/departments?pageSize=200");
  const qualifications = useOptions<{ id: string; label: string; status?: string }>("/api/reference/parameters?category=qualification-types");
  const source = initial ?? duplicateOf;
  const { form, set, errors, setErrors, formError, saving, save, back } = useRecordForm(
    "programs",
    "/institution/programs",
    {
      code: source?.code ?? "",
      name: source?.name ?? "",
      facultyId: source?.facultyId ?? "",
      departmentId: source?.departmentId ?? "",
      qualificationId: source?.qualificationId ?? "",
      durationYears: String(source?.durationYears ?? 3),
      studyMode: (source?.studyMode ?? "FULL_TIME") as StudyMode,
      language: (source?.language ?? "EN") as TeachingLanguage,
      availableSpaces: String(source?.availableSpaces ?? 0),
    },
    initial?.id
  );
  const offeredFaculties = faculties.filter((f) => f.status === "ACTIVE" || f.id === form.facultyId);
  const offeredDepartments = departments.filter((d) => d.facultyId === form.facultyId && (d.status === "ACTIVE" || d.id === form.departmentId));
  // Only the institution's Anticipated Qualifications (and the one a program already has).
  const [ours, setOurs] = useState<Set<string> | null>(null);
  useEffect(() => {
    fetch("/api/institution/qualifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && setOurs(new Set((b.data.offered as { id: string }[]).map((o) => o.id))))
      .catch(() => undefined);
  }, []);
  const offeredQualifications = qualifications.filter((q) => q.id === form.qualificationId || ((q.status ?? "ACTIVE") === "ACTIVE" && (!ours || ours.has(q.id))));

  return (
    <div className="max-w-2xl space-y-4">
      {duplicateOf && (
        <p role="status" className="rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          {tr("Duplicating {name} ({code}). Give the new program its own code and change anything that differs, then save.", { name: tr(duplicateOf.name), code: duplicateOf.code })}
        </p>
      )}
      <Field label={tr("Program code")} required error={errors.code} hint={tr("Unique within your institution, e.g. BSC-CS.")}>
        <TextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
      </Field>
      <Field label={tr("Program name")} required error={errors.name}>
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label={tr("Faculty")} required error={errors.facultyId}>
        <SelectInput
          value={form.facultyId}
          onChange={(e) => {
            set("facultyId", e.target.value);
            // The department has to be one of the new faculty's.
            set("departmentId", "");
          }}
        >
          <option value="">{tr("Select…")}</option>
          {offeredFaculties.map((f) => (
            <option key={f.id} value={f.id}>
              {tr(f.name)}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={tr("Department")} required error={errors.departmentId} hint={form.facultyId ? undefined : tr("Choose a faculty first.")}>
        <SelectInput value={form.departmentId} disabled={!form.facultyId} onChange={(e) => set("departmentId", e.target.value)}>
          <option value="">{tr("Select…")}</option>
          {offeredDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {tr(d.name)}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={tr("Qualification")} required error={errors.qualificationId}>
        <SelectInput value={form.qualificationId} onChange={(e) => set("qualificationId", e.target.value)}>
          <option value="">{tr("Select…")}</option>
          {offeredQualifications.map((q) => (
            <option key={q.id} value={q.id}>
              {tr(q.label)}
            </option>
          ))}
        </SelectInput>
      </Field>
      {ours && ours.size === 0 && (
        <p className="text-sm text-[var(--color-ink-soft)]">
          {tr("Your institution has no Anticipated Qualifications yet.")}{" "}
          <a href="/institution/qualifications" className="underline">
            {tr("Choose them first.")}
          </a>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={tr("Duration (years)")} required error={errors.durationYears}>
          <TextInput type="number" min={0.5} max={8} step={0.5} value={form.durationYears} onChange={(e) => set("durationYears", e.target.value)} />
        </Field>
        <Field label={tr("Study mode")} error={errors.studyMode}>
          <SelectInput value={form.studyMode} onChange={(e) => set("studyMode", e.target.value as StudyMode)}>
            {(Object.keys(STUDY_MODE_LABELS) as StudyMode[]).map((m) => (
              <option key={m} value={m}>
                {tr(STUDY_MODE_LABELS[m])}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={tr("Language")} error={errors.language}>
          <SelectInput value={form.language} onChange={(e) => set("language", e.target.value as TeachingLanguage)}>
            {(Object.keys(LANGUAGE_LABELS) as TeachingLanguage[]).map((l) => (
              <option key={l} value={l}>
                {tr(LANGUAGE_LABELS[l])}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label={tr("Available spaces")} required error={errors.availableSpaces} hint={tr("How many applicants the program can take.")}>
        <TextInput type="number" min={0} step={1} value={form.availableSpaces} onChange={(e) => set("availableSpaces", e.target.value)} />
      </Field>

      {formError && <FormError>{tr(formError)}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton
          disabled={saving}
          onClick={() => {
            // The copy is a new program, so it can't keep the original's code. (The server checks every other clash.)
            if (duplicateOf && form.code.trim().toUpperCase() === duplicateOf.code.toUpperCase()) {
              setErrors({ code: tr("Give the new program its own code; {code} already belongs to {name}.", { code: duplicateOf.code, name: tr(duplicateOf.name) }) });
              return;
            }
            void save(
              { code: "Enter a program code.", name: tr("Enter the program's name."), facultyId: "Choose a faculty.", departmentId: "Choose a department.", qualificationId: "Choose the qualification it leads to.", durationYears: "Enter the duration.", availableSpaces: "Enter the number of spaces, or 0." },
              { ...form, durationYears: Number(form.durationYears), availableSpaces: Number(form.availableSpaces) }
            );
          }}
        >
          {saving ? tr("Saving…") : tr("Save")}
        </PrimaryButton>
        <SecondaryButton onClick={back}>{tr("Cancel")}</SecondaryButton>
      </div>
    </div>
  );
}
