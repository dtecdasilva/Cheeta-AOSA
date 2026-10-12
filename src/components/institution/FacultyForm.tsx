"use client";

import { Field, FormError, PrimaryButton, SecondaryButton, TextInput } from "@/components/Form";
import type { Faculty } from "@/lib/institution/types";
import { useRecordForm } from "./useRecordForm";

/** Adds a faculty or school to the institution, or edits one. Saved through /api/institution/faculties. */
export default function FacultyForm({ initial }: { initial?: Faculty }) {
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "faculties",
    "/institution/faculty",
    { name: initial?.name ?? "", code: initial?.code ?? "", dean: initial?.dean ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", address: initial?.address ?? "" },
    initial?.id
  );

  return (
    <div className="max-w-2xl space-y-4">
      <Field label="Faculty name" required error={errors.name}>
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Code" required error={errors.code} hint="A short code for the faculty, unique within your institution, e.g. SCI.">
        <TextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
      </Field>
      <Field label="Dean" error={errors.dean}>
        <TextInput value={form.dean} onChange={(e) => set("dean", e.target.value)} />
      </Field>
      <Field label="Phone" error={errors.phone}>
        <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Email" error={errors.email}>
        <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Address" error={errors.address}>
        <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>

      {formError && <FormError>{formError}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton disabled={saving} onClick={() => save({ name: "Enter the faculty's name.", code: "Enter a code." })}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
        <SecondaryButton onClick={back}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
