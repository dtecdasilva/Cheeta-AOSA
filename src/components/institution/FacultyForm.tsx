"use client";

import { Field, TextInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { Faculty, mockFaculties } from "@/lib/mockData/faculties";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FacultyForm({ institutionId, initial }: { institutionId: string; initial?: Faculty }) {
  const [form, setForm] = useState<Partial<Faculty>>({ ...(initial ?? {}), institutionId });
  const router = useRouter();

  function onChange<K extends keyof Faculty>(k: K, v: Faculty[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    // Mock save: push to mockFaculties array (in-memory)
    if (initial) {
      const idx = mockFaculties.findIndex((f) => f.id === initial.id);
      if (idx !== -1) mockFaculties[idx] = { ...(mockFaculties[idx] as Faculty), ...(form as Faculty) };
    } else {
      const id = `fac-${Date.now()}`;
      mockFaculties.push({ ...(form as Faculty), id } as Faculty);
    }
    router.push("/institution/faculty");
  }

  return (
    <div className="space-y-4">
      <Field label="Faculty name" required>
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
