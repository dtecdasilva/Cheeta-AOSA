"use client";

import { useState } from "react";
import { Application, PersonalInfo } from "@/lib/types";
import { Field, TextInput, PrimaryButton, SecondaryButton } from "@/components/Form";

const EMPTY: PersonalInfo = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  nationality: "",
  email: "",
  phone: "",
  region: "",
  city: "",
  address: "",
  guardianName: "",
  guardianPhone: "",
};

export function PersonalStep({
  application,
  editable,
  onSave,
  onSubmit,
}: {
  application: Application;
  editable: boolean;
  onSave: (info: PersonalInfo) => void;
  onSubmit: () => void;
}) {
  const [form, setForm] = useState<PersonalInfo>(application.personalInfo ?? EMPTY);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  const isComplete = Object.entries(form).every(([k, v]) => {
    if (k === "guardianName" || k === "guardianPhone") return true;
    return v.trim().length > 0;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" required>
          <TextInput value={form.firstName} onChange={(e) => update("firstName", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Last name" required>
          <TextInput value={form.lastName} onChange={(e) => update("lastName", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Date of birth" required>
          <TextInput type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Gender" required>
          <TextInput value={form.gender} onChange={(e) => update("gender", e.target.value)} placeholder="e.g. Female" disabled={!editable} />
        </Field>
        <Field label="Nationality" required>
          <TextInput value={form.nationality} onChange={(e) => update("nationality", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Email address" required>
          <TextInput type="email" value={form.email} onChange={(e) => update("email", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Phone number" required>
          <TextInput value={form.phone} onChange={(e) => update("phone", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Region" required>
          <TextInput value={form.region} onChange={(e) => update("region", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="City" required>
          <TextInput value={form.city} onChange={(e) => update("city", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Residential address" required>
          <TextInput value={form.address} onChange={(e) => update("address", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Guardian full name" hint="Optional, for minors.">
          <TextInput value={form.guardianName} onChange={(e) => update("guardianName", e.target.value)} disabled={!editable} />
        </Field>
        <Field label="Guardian phone" hint="Optional, for minors.">
          <TextInput value={form.guardianPhone} onChange={(e) => update("guardianPhone", e.target.value)} disabled={!editable} />
        </Field>
      </div>

      {editable && (
        <div className="flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
          <SecondaryButton
            type="button"
            onClick={() => {
              onSave(form);
              setSaved(true);
            }}
          >
            Save progress
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={!isComplete}
            onClick={() => {
              onSave(form);
              onSubmit();
            }}
          >
            Submit and continue
          </PrimaryButton>
          {saved && <span className="text-xs text-[var(--color-success)]">Saved</span>}
        </div>
      )}
    </div>
  );
}
