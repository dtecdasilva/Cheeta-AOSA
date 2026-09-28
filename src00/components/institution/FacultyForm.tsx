"use client";

import { Field, TextInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import {Faculty} from "@/lib/mockData/faculties";
import { useState } from "react";
import { useRouter } from "next/navigation";

const REQUIRED: (keyof Faculty)[] = ["name"];

export default function FacultyForm({ institutionId, initial }: { institutionId: string; initial?: Faculty }) {
  const [form, setForm] = useState<Partial<Faculty>>({ ...(initial ?? {}), institutionId });
  const [errors, setErrors] = useState<Partial<Record<keyof Faculty, string>>>({});
  const router = useRouter();

  function onChange<K extends keyof Faculty>(k: K, v: Faculty[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    const missing = REQUIRED.filter((k) => !String(form[k] ?? "").trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((k) => [k, "This field is required."])));
      return;
    }
    setErrors({});
    // No persistence layer exists for institution configuration yet. The
    // previous version pushed straight into the imported mockFaculties
    // array, which mutated module state every other screen reads from and
    // vanished on reload — worse than not saving, because it looked like
    // it had. Navigating back keeps the flow intact until a real endpoint
    // replaces this call.
    router.push("/institution/faculty");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Field label="Faculty name" required error={errors.name}>
        <TextInput value={form.name ?? ""} onChange={(e) => onChange("name", e.target.value)} />
      </Field>

      <Field label="Dean">
        <TextInput value={form.dean ?? ""} onChange={(e) => onChange("dean", e.target.value)} />
      </Field>

      <Field label="Phone">
        <TextInput value={form.phone ?? ""} onChange={(e) => onChange("phone", e.target.value)} />
      </Field>

      <Field label="Email">
        <TextInput value={form.email ?? ""} onChange={(e) => onChange("email", e.target.value)} />
      </Field>

      <div className="flex items-center gap-2">
        <PrimaryButton onClick={onSave}>Save</PrimaryButton>
        <SecondaryButton onClick={() => router.back()}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
