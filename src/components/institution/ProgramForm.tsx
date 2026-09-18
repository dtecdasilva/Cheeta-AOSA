"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { mockPrograms, StudyProgramDef } from "@/lib/mockData/programs";
import { mockFaculties } from "@/lib/mockData/faculties";
import { mockDepartments } from "@/lib/mockData/departments";
import { mockQualifications } from "@/lib/mockData/qualifications";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProgramForm({ institutionId, initial }: { institutionId: string; initial?: StudyProgramDef }) {
  const [form, setForm] = useState<Partial<StudyProgramDef>>({ ...(initial ?? {}), institutionId });
  const router = useRouter();

  const faculties = mockFaculties.filter((f) => f.institutionId === institutionId);
  const departments = mockDepartments.filter((d) => d.institutionId === institutionId && (!form.facultyId || d.facultyId === form.facultyId));
  const qualifications = mockQualifications.filter((q) => q.institutionId === institutionId && (!form.facultyId || q.facultyId === form.facultyId));

  function onChange<K extends keyof StudyProgramDef>(k: K, v: any) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    if (initial) {
      const idx = mockPrograms.findIndex((p) => p.id === initial.id);
      if (idx !== -1) mockPrograms[idx] = { ...(mockPrograms[idx] as StudyProgramDef), ...(form as StudyProgramDef) };
    } else {
      const id = `prog-${Date.now()}`;
      mockPrograms.push({ ...(form as StudyProgramDef), id } as StudyProgramDef);
    }
    router.push("/institution/programs");
  }

  return (
    <div className="space-y-4">
      <Field label="Program code" required>
        <TextInput value={form.code ?? ""} onChange={(e) => onChange("code", e.target.value)} />
      </Field>

      <Field label="Program name" required>
        <TextInput value={form.name ?? ""} onChange={(e) => onChange("name", e.target.value)} />
      </Field>

      <Field label="Faculty">
        <SelectInput value={form.facultyId ?? ""} onChange={(e) => onChange("facultyId", e.target.value)}>
          <option value="">Select</option>
          {faculties.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Department">
        <SelectInput value={form.departmentId ?? ""} onChange={(e) => onChange("departmentId", e.target.value)}>
          <option value="">Select</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Qualification">
        <SelectInput value={form.qualificationId ?? ""} onChange={(e) => onChange("qualificationId", e.target.value)}>
          <option value="">Select</option>
          {qualifications.map((q) => (
            <option key={q.id} value={q.id}>{q.name}</option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Available spaces">
        <TextInput type="number" value={String(form.availableSpaces ?? "")} onChange={(e) => onChange("availableSpaces", Number(e.target.value))} />
      </Field>

      <div className="flex items-center gap-2">
        <PrimaryButton onClick={onSave}>Save</PrimaryButton>
        <SecondaryButton onClick={() => router.back()}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
