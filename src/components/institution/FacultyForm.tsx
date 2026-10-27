"use client";

import { Field, FormError, PrimaryButton, SecondaryButton, TextInput } from "@/components/Form";
import type { Faculty } from "@/lib/institution/types";
import { useRecordForm } from "./useRecordForm";
import { LocationFields } from "./LocationFields";
import { useT } from "@/lib/i18n/client";

/** Adds a faculty or school to the institution, or edits one. Saved through /api/institution/faculties. */
export default function FacultyForm({ initial }: { initial?: Faculty }) {
  const tr = useT();
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "faculties",
    "/institution/faculty",
    { name: initial?.name ?? "", code: initial?.code ?? "", dean: initial?.dean ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", address: initial?.address ?? "", location: initial?.location ?? "", regionId: initial?.regionId ?? "", townId: initial?.townId ?? "" },
    initial?.id
  );

  return (
    <div className="max-w-2xl space-y-4">
      <Field label={tr("Faculty name")} required error={errors.name}>
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label={tr("Code")} required error={errors.code} hint={tr("A short code for the faculty, unique within your institution, e.g. SCI.")}>
        <TextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
      </Field>
      <Field label={tr("Dean")} error={errors.dean}>
        <TextInput value={form.dean} onChange={(e) => set("dean", e.target.value)} />
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
        <PrimaryButton disabled={saving} onClick={() => save({ name: tr("Enter the faculty's name."), code: "Enter a code." }, { ...form, regionId: form.regionId || null, townId: form.townId || null })}>
          {saving ? tr("Saving…") : tr("Save")}
        </PrimaryButton>
        <SecondaryButton onClick={back}>{tr("Cancel")}</SecondaryButton>
      </div>
    </div>
  );
}
