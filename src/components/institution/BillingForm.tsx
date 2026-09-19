"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { FeeConfig, FeeCategory } from "@/lib/mockData/billing";
import { useState } from "react";
import { useRouter } from "next/navigation";

const REQUIRED: (keyof FeeConfig)[] = ["name"];

export default function BillingForm({ institutionId, initial }: { institutionId: string; initial?: FeeConfig }) {
  const [form, setForm] = useState<Partial<FeeConfig>>({ ...(initial ?? {}), institutionId });
  const [errors, setErrors] = useState<Partial<Record<keyof FeeConfig, string>>>({});
  const router = useRouter();

  function onChange<K extends keyof FeeConfig>(k: K, v: FeeConfig[K]) {
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
    // previous version pushed straight into the imported mockBillingConfigs
    // array, which mutated module state every other screen reads from and
    // vanished on reload — worse than not saving, because it looked like
    // it had. Navigating back keeps the flow intact until a real endpoint
    // replaces this call.
    router.push("/institution/billing");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Field label="Fee name" required error={errors.name}>
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
        <SelectInput value={form.category ?? "national"} onChange={(e) => onChange("category", e.target.value as FeeCategory)}>
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
        <SelectInput value={form.status ?? "active"} onChange={(e) => onChange("status", e.target.value as FeeConfig["status"])}>
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
