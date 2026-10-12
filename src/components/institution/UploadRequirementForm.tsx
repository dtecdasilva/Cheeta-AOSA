"use client";

import { useState } from "react";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import {
  MIN_UPLOAD_SIZE_KB,
  UPLOAD_FILE_TYPE_LABELS,
  formatFileSize,
  normaliseFileType,
  validateRequirementLimits,
  type DocumentTypeOption,
  type UploadFileType,
  type UploadRequirement,
} from "@/lib/institution/uploadRequirements";
import { useRecordForm } from "./useRecordForm";

/**
 * Adds one of the institution's upload requirements, or edits one.
 *
 * The document type comes from the platform's list; it decides which
 * file types can be accepted and the largest size, and the institution
 * chooses within those. The same rules are applied here and by the API
 * (src/lib/institution/uploadRequirements.ts). Saved through
 * /api/institution/upload-requirements.
 */
export default function UploadRequirementForm({ initial, documentTypes }: { initial?: UploadRequirement; documentTypes: DocumentTypeOption[] }) {
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "upload-requirements",
    "/institution/uploads/requirements",
    {
      documentTypeId: initial?.documentTypeId ?? "",
      description: initial?.description ?? "",
      required: initial?.required ?? true,
      fileTypes: (initial?.fileTypes ?? []).map(normaliseFileType),
      maxSizeKb: initial ? String(initial.maxSizeKb) : "",
      status: initial?.status ?? "ACTIVE",
    },
    initial?.id
  );
  const [attempted, setAttempted] = useState(false);

  // A type can be asked for once, so those already on the list aren't offered, apart from this requirement's own.
  const options = documentTypes.filter((t) => !t.inUse || t.id === initial?.documentTypeId);
  const type = documentTypes.find((t) => t.id === form.documentTypeId);
  const sizeKb = Number(form.maxSizeKb);
  const limitErrors = type ? validateRequirementLimits({ fileTypes: form.fileTypes, maxSizeKb: form.maxSizeKb.trim() ? sizeKb : NaN }, type) : {};

  function chooseType(id: string) {
    const next = documentTypes.find((t) => t.id === id);
    set("documentTypeId", id);
    if (!next) return;
    // Start from everything the type allows; keep what was already chosen where it still fits.
    const kept = form.fileTypes.filter((t) => (next.fileTypes as string[]).includes(t));
    set("fileTypes", kept.length ? kept : [...next.fileTypes]);
    set("maxSizeKb", String(form.maxSizeKb.trim() && sizeKb <= next.maxSizeKb && sizeKb >= MIN_UPLOAD_SIZE_KB ? sizeKb : next.maxSizeKb));
  }

  function toggleFileType(t: UploadFileType, on: boolean) {
    set("fileTypes", on ? [...form.fileTypes, t] : form.fileTypes.filter((x) => x !== t));
  }

  function submit() {
    setAttempted(true);
    if (type && Object.keys(limitErrors).length) return;
    const { status, maxSizeKb, ...values } = form;
    const body = { ...values, description: values.description.trim(), maxSizeKb: Number(maxSizeKb) };
    // On a new requirement the status isn't sent: it starts active.
    void save({ documentTypeId: "Choose the document type." }, initial ? { ...body, status } : body);
  }

  const fileTypesError = errors.fileTypes || (attempted ? limitErrors.fileTypes : undefined);
  const sizeError = errors.maxSizeKb || (attempted ? limitErrors.maxSizeKb : undefined);

  return (
    <div className="max-w-2xl space-y-4">
      {options.length === 0 && !initial && <FormError>Every document type on the platform&apos;s list is already on your requirements. Edit one of those instead.</FormError>}

      <Field
        label="Document type"
        required
        error={errors.documentTypeId}
        hint={type ? (type.certified ? "A certified copy is expected for this document." : "A plain copy is accepted for this document.") : "The document applicants are asked for. The list is kept by Cheeta administration."}
      >
        <SelectInput value={form.documentTypeId} onChange={(e) => chooseType(e.target.value)}>
          <option value="">Choose a document type…</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Description" error={errors.description} hint="Shown to applicants under the document's name: what exactly to upload.">
        <TextArea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} placeholder="Full birth certificate issued by a civil status registry." />
      </Field>

      <Field label="Required or optional" error={errors.required} hint={form.required ? "An application can't be submitted without this document." : "Applicants may upload it, but can submit without it."}>
        <SelectInput value={form.required ? "yes" : "no"} onChange={(e) => set("required", e.target.value === "yes")}>
          <option value="yes">Required</option>
          <option value="no">Optional</option>
        </SelectInput>
      </Field>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
          File types<span className="text-[var(--color-danger)]"> *</span>
        </legend>
        {type ? (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {type.fileTypes.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                <input type="checkbox" checked={form.fileTypes.includes(t)} onChange={(e) => toggleFileType(t, e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                {UPLOAD_FILE_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Choose the document type first.</p>
        )}
        {fileTypesError ? (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{fileTypesError}</p>
        ) : (
          type && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">The formats this document can be uploaded in. A file that isn&apos;t really one of the types ticked is refused.</p>
        )}
      </fieldset>

      <Field
        label="Maximum file size (KB)"
        required
        error={sizeError}
        hint={type ? `${Number.isFinite(sizeKb) && sizeKb > 0 ? `${formatFileSize(sizeKb)}. ` : ""}The most allowed for this document is ${formatFileSize(type.maxSizeKb)} (${type.maxSizeKb} KB).` : "1024 KB is 1 MB."}
      >
        <TextInput type="number" inputMode="numeric" min={MIN_UPLOAD_SIZE_KB} max={type?.maxSizeKb} step={1} value={form.maxSizeKb} onChange={(e) => set("maxSizeKb", e.target.value)} />
      </Field>

      {initial && (
        <Field label="Status" error={errors.status} hint="Applicants are only asked for active requirements.">
          <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as "ACTIVE" | "INACTIVE")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectInput>
        </Field>
      )}

      {formError && <FormError>{formError}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
        <SecondaryButton onClick={back}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
