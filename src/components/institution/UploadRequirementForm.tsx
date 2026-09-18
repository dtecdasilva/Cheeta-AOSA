"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { UploadRequirement, mockUploadRequirements, FileType } from "@/lib/mockData/uploadRequirements";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadRequirementForm({ institutionId, initial }: { institutionId: string; initial?: UploadRequirement }) {
  const [form, setForm] = useState<Partial<UploadRequirement>>({ ...(initial ?? {}), institutionId });
  const router = useRouter();

  function onChange<K extends keyof UploadRequirement>(k: K, v: any) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    if (initial) {
      const idx = mockUploadRequirements.findIndex((r) => r.id === initial.id);
      if (idx !== -1) mockUploadRequirements[idx] = { ...(mockUploadRequirements[idx] as UploadRequirement), ...(form as UploadRequirement) };
    } else {
      const id = `req-${Date.now()}`;
      mockUploadRequirements.push({ ...(form as UploadRequirement), id } as UploadRequirement);
    }
    router.push("/institution/uploads/requirements");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Field label="Document name" required>
        <TextInput value={form.name ?? ""} onChange={(e) => onChange("name", e.target.value)} />
      </Field>

      <Field label="Description">
        <TextInput value={form.description ?? ""} onChange={(e) => onChange("description", e.target.value)} />
      </Field>

      <Field label="Required">
        <SelectInput value={form.required ? "true" : "false"} onChange={(e) => onChange("required", e.target.value === "true") }>
          <option value="true">Required</option>
          <option value="false">Optional</option>
        </SelectInput>
      </Field>

      <Field label="File type">
        <SelectInput value={form.fileType ?? "pdf"} onChange={(e) => onChange("fileType", e.target.value as FileType)}>
          <option value="pdf">PDF</option>
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
          <option value="zip">ZIP</option>
          <option value="doc">DOC</option>
          <option value="docx">DOCX</option>
        </SelectInput>
      </Field>

      <Field label="Max file size (KB)">
        <TextInput type="number" value={String(form.maxSizeKb ?? 0)} onChange={(e) => onChange("maxSizeKb", Number(e.target.value))} />
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
"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { UploadRequirement, mockUploadRequirements } from "@/lib/mockData/uploadRequirements";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadRequirementForm({ institutionId, initial }: { institutionId: string; initial?: UploadRequirement }) {
  const [form, setForm] = useState<Partial<UploadRequirement>>({ ...(initial ?? {}), institutionId });
  const router = useRouter();

  function onChange<K extends keyof UploadRequirement>(k: K, v: any) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    if (initial) {
      const idx = mockUploadRequirements.findIndex((r) => r.id === initial.id);
      if (idx !== -1) mockUploadRequirements[idx] = { ...(mockUploadRequirements[idx] as UploadRequirement), ...(form as UploadRequirement) };
    } else {
      const id = `ur-${Date.now()}`;
      const toAdd: UploadRequirement = { ...(form as UploadRequirement), id } as UploadRequirement;
      mockUploadRequirements.push(toAdd);
    }
    router.push("/institution/uploads/requirements");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Field label="Document name" required>
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
