"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import {UploadRequirement} from "@/lib/mockData/uploadRequirements";
import { useState } from "react";
import { useRouter } from "next/navigation";

const REQUIRED: (keyof UploadRequirement)[] = ["name"];

export default function UploadRequirementForm({ institutionId, initial }: { institutionId: string; initial?: UploadRequirement }) {
  const [form, setForm] = useState<Partial<UploadRequirement>>({ ...(initial ?? {}), institutionId });
  const [errors, setErrors] = useState<Partial<Record<keyof UploadRequirement, string>>>({});
  const router = useRouter();

  function onChange<K extends keyof UploadRequirement>(k: K, v: UploadRequirement[K]) {
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
    // previous version pushed straight into the imported mockUploadRequirements
    // array, which mutated module state every other screen reads from and
    // vanished on reload — worse than not saving, because it looked like
    // it had. Navigating back keeps the flow intact until a real endpoint
    // replaces this call.
    router.push("/institution/uploads/requirements");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Field label="Document name" required error={errors.name}>
        <TextInput value={form.name ?? ""} onChange={(e) => onChange("name", e.target.value)} />
      </Field>

      <Field label="Description">
        <TextInput value={form.description ?? ""} onChange={(e) => onChange("description", e.target.value)} />
      </Field>

      <Field label="Required">
        <SelectInput value={form.required ? "yes" : "no"} onChange={(e) => onChange("required", e.target.value === "yes")}>
          <option value="yes">Required</option>
          <option value="no">Optional</option>
        </SelectInput>
      </Field>

      <Field label="File types (comma separated, e.g. pdf,jpg)">
        <TextInput value={(form.fileTypes ?? []).join(",")} onChange={(e) => onChange("fileTypes", e.target.value.split(",").map((s) => s.trim()))} />
      </Field>

      <Field label="Max file size (KB)">
        <TextInput type="number" value={String(form.maxSizeKB ?? "")} onChange={(e) => onChange("maxSizeKB", Number(e.target.value))} />
      </Field>

      <Field label="Status">
        <SelectInput value={form.status ?? "active"} onChange={(e) => onChange("status", e.target.value as UploadRequirement["status"])}>
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
