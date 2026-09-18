"use client";

import { Field, TextInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { Department, mockDepartments } from "@/lib/mockData/departments";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DepartmentForm({ institutionId, initial }: { institutionId: string; initial?: Department }) {
  const [form, setForm] = useState<Partial<Department>>({ ...(initial ?? {}), institutionId });
  const router = useRouter();

  function onChange<K extends keyof Department>(k: K, v: Department[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    if (initial) {
      const idx = mockDepartments.findIndex((d) => d.id === initial.id);
      if (idx !== -1) mockDepartments[idx] = { ...(mockDepartments[idx] as Department), ...(form as Department) };
    } else {
      const id = `dep-${Date.now()}`;
      mockDepartments.push({ ...(form as Department), id } as Department);
    }
    router.push("/institution/departments");
  }

  return (
    <div className="space-y-4">
      <Field label="Department name" required>
        <TextInput value={form.name ?? ""} onChange={(e) => onChange("name", e.target.value)} />
      </Field>

      <Field label="Head of Department">
        <TextInput value={form.head ?? ""} onChange={(e) => onChange("head", e.target.value)} />
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
