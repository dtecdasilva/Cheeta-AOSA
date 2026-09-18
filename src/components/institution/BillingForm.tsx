"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { FeeConfig, mockBillingConfigs } from "@/lib/mockData/billing";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BillingForm({ institutionId, initial }: { institutionId: string; initial?: FeeConfig }) {
  const [form, setForm] = useState<Partial<FeeConfig>>({ ...(initial ?? {}), institutionId });
  const router = useRouter();

  function onChange<K extends keyof FeeConfig>(k: K, v: any) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    if (initial) {
      const idx = mockBillingConfigs.findIndex((b) => b.id === initial.id);
      if (idx !== -1) mockBillingConfigs[idx] = { ...(mockBillingConfigs[idx] as FeeConfig), ...(form as FeeConfig) };
    } else {
      const id = `fee-${Date.now()}`;
      mockBillingConfigs.push({ ...(form as FeeConfig), id } as FeeConfig);
    }
    router.push("/institution/billing");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Field label="Fee name" required>
        <TextInput value={form.name ?? ""} onChange={(e) => onChange("name", e.target.value)} />
      </Field>

      <Field label="Type">
        <SelectInput value={form.type ?? ""} onChange={(e) => onChange("type", e.target.value)}>
          <option value="application">Application</option>
          <option value="web">Web</option>
          <option value="other">Other</option>
        </SelectInput>
      </Field>

      <Field label="Category">
        <SelectInput value={form.category ?? "national"} onChange={(e) => onChange("category", e.target.value)}>
          <option value="national">National</option>
          <option value="international">International</option>
        </SelectInput>
      </Field>

      <Field label="Currency">
        <TextInput value={form.currency ?? ""} onChange={(e) => onChange("currency", e.target.value)} />
      </Field>

      <Field label="Amount">
        <TextInput type="number" value={String(form.amount ?? "")} onChange={(e) => onChange("amount", Number(e.target.value))} />
      </Field>

      <Field label="Effective date">
        <TextInput type="date" value={form.effectiveDate ?? ""} onChange={(e) => onChange("effectiveDate", e.target.value)} />
      </Field>

      <Field label="Status">
        <SelectInput value={form.status ?? "active"} onChange={(e) => onChange("status", e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectInput>
      </Field>

      <div className="flex items-center gap-2">
        <PrimaryButton onClick={onSave}>Save</PrimaryButton>
        <SecondaryButton onClick={() => router.back()}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
