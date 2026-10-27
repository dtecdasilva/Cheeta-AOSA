"use client";

import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { useOptions } from "@/lib/institution/api";
import type { Department, Faculty } from "@/lib/institution/types";
import { useRecordForm } from "./useRecordForm";
import { LocationFields } from "./LocationFields";
import { useT } from "@/lib/i18n/client";

/** Adds a department under one of the institution's faculties, or edits one. Saved through /api/institution/departments. */
export default function DepartmentForm({ initial }: { initial?: Department }) {
  const tr = useT();
  const faculties = useOptions<Faculty>("/api/institution/faculties?pageSize=200");
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "departments",
    "/institution/departments",
    { name: initial?.name ?? "", code: initial?.code ?? "", facultyId: initial?.facultyId ?? "", head: initial?.head ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", address: initial?.address ?? "", location: initial?.location ?? "", regionId: initial?.regionId ?? "", townId: initial?.townId ?? "" },
    initial?.id
  );
  // A faculty that has been deactivated can stay on a department that already has it, but isn't offered for a new choice.
  const offered = faculties.filter((f) => f.status === "ACTIVE" || f.id === form.facultyId);

  return (
    <div className="max-w-2xl space-y-4">
      <Field label={tr("Department name")} required error={errors.name}>
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label={tr("Code")} required error={errors.code} hint={tr("A short code for the department, unique within your institution, e.g. CS.")}>
        <TextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
      </Field>
      <Field label={tr("Faculty")} required error={errors.facultyId}>
        <SelectInput value={form.facultyId} onChange={(e) => set("facultyId", e.target.value)}>
          <option value="">{tr("Select…")}</option>
          {offered.map((f) => (
            <option key={f.id} value={f.id}>
              {tr(f.name)}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={tr("Head of Department")} error={errors.head}>
        <TextInput value={form.head} onChange={(e) => set("head", e.target.value)} />
      </Field>
      <Field label={tr("Phone")} error={errors.phone}>
        <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label={tr("Email")} error={errors.email}>
        <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label={tr("Address")} error={errors.address}>
        <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <LocationFields value={form} onChange={(p) => Object.entries(p).forEach(([k, v]) => set(k as "location", v as string))} errors={errors} />

      {formError && <FormError>{tr(formError)}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton disabled={saving} onClick={() => save({ name: tr("Enter the department's name."), code: "Enter a code.", facultyId: "Choose the faculty it belongs to." }, { ...form, regionId: form.regionId || null, townId: form.townId || null })}>
          {saving ? tr("Saving…") : tr("Save")}
        </PrimaryButton>
        <SecondaryButton onClick={back}>{tr("Cancel")}</SecondaryButton>
      </div>
    </div>
  );
}
