"use client";

import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { useOptions } from "@/lib/institution/api";
import type { Department, Faculty } from "@/lib/institution/types";
import { useRecordForm } from "./useRecordForm";

/** Adds a department under one of the institution's faculties, or edits one. Saved through /api/institution/departments. */
export default function DepartmentForm({ initial }: { initial?: Department }) {
  const faculties = useOptions<Faculty>("/api/institution/faculties?pageSize=200");
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "departments",
    "/institution/departments",
    { name: initial?.name ?? "", code: initial?.code ?? "", facultyId: initial?.facultyId ?? "", head: initial?.head ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "" },
    initial?.id
  );
  // A faculty that has been deactivated can stay on a department that already has it, but isn't offered for a new choice.
  const offered = faculties.filter((f) => f.status === "ACTIVE" || f.id === form.facultyId);

  return (
    <div className="max-w-2xl space-y-4">
      <Field label="Department name" required error={errors.name}>
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Code" required error={errors.code} hint="A short code for the department, unique within your institution, e.g. CS.">
        <TextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
      </Field>
      <Field label="Faculty" required error={errors.facultyId}>
        <SelectInput value={form.facultyId} onChange={(e) => set("facultyId", e.target.value)}>
          <option value="">Select…</option>
          {offered.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Head of Department" error={errors.head}>
        <TextInput value={form.head} onChange={(e) => set("head", e.target.value)} />
      </Field>
      <Field label="Phone" error={errors.phone}>
        <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Email" error={errors.email}>
        <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>

      {formError && <FormError>{formError}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton disabled={saving} onClick={() => save({ name: "Enter the department's name.", code: "Enter a code.", facultyId: "Choose the faculty it belongs to." })}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
        <SecondaryButton onClick={back}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
