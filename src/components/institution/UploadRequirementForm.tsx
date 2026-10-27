"use client";

import { useState } from "react";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import {
  CUSTOM_DOCUMENT_TYPE,
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
import { useT } from "@/lib/i18n/client";

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
  const tr = useT();
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "upload-requirements",
    "/institution/uploads/requirements",
    {
      documentTypeId: initial?.custom ? CUSTOM_DOCUMENT_TYPE : (initial?.documentTypeId ?? ""),
      name: initial?.custom ? initial.name : "",
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
    const { name, ...rest } = values;
    const custom = values.documentTypeId === CUSTOM_DOCUMENT_TYPE;
    const body = { ...rest, ...(custom ? { name: name.trim() } : {}), description: values.description.trim(), maxSizeKb: Number(maxSizeKb) };
    // On a new requirement the status isn't sent: it starts active.
    void save({ documentTypeId: "Choose the document type." }, initial ? { ...body, status } : body);
  }

  const fileTypesError = errors.fileTypes || (attempted ? limitErrors.fileTypes : undefined);
  const sizeError = errors.maxSizeKb || (attempted ? limitErrors.maxSizeKb : undefined);

  return (
    <div className="max-w-2xl space-y-4">
      {options.length === 1 && !initial && <p className="text-sm text-[var(--color-ink-soft)]">{tr("Every document type on the platform's list is already on your requirements. You can still add a document of your own.")}</p>}

      <Field
        label={tr("Document type")}
        required
        error={errors.documentTypeId}
        hint={type ? (type.certified ? tr("A certified copy is expected for this document.") : tr("A plain copy is accepted for this document.")) : tr("The document applicants are asked for. The list is kept by Cheeta administration.")}
      >
        <SelectInput value={form.documentTypeId} onChange={(e) => chooseType(e.target.value)}>
          <option value="">{tr("Choose a document type…")}</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {tr(t.label)}
            </option>
          ))}
        </SelectInput>
      </Field>

      {form.documentTypeId === CUSTOM_DOCUMENT_TYPE && (
        <Field label={tr("Upload name")} required error={errors.name} hint={tr("What applicants see the document called, for a document that isn't on the platform's list.")}>
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={150} placeholder={tr("Letter of recommendation")} />
        </Field>
      )}

      <Field label={tr("Description")} error={errors.description} hint={tr("Shown to applicants under the document's name: what exactly to upload.")}>
        <TextArea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} placeholder={tr("Full birth certificate issued by a civil status registry.")} />
      </Field>

      <Field label={tr("Required or optional")} error={errors.required} hint={form.required ? tr("An application can't be submitted without this document.") : tr("Applicants may upload it, but can submit without it.")}>
        <SelectInput value={form.required ? "yes" : "no"} onChange={(e) => set("required", e.target.value === "yes")}>
          <option value="yes">{tr("Required")}</option>
          <option value="no">{tr("Optional")}</option>
        </SelectInput>
      </Field>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
          {tr("File types")}<span className="text-[var(--color-danger)]"> *</span>
        </legend>
        {type ? (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {type.fileTypes.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                <input type="checkbox" checked={form.fileTypes.includes(t)} onChange={(e) => toggleFileType(t, e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                {tr(UPLOAD_FILE_TYPE_LABELS[t])}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">{tr("Choose the document type first.")}</p>
        )}
        {fileTypesError ? (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{tr(fileTypesError)}</p>
        ) : (
          type && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{tr("The formats this document can be uploaded in. A file that isn't really one of the types ticked is refused.")}</p>
        )}
      </fieldset>

      <Field
        label={tr("Maximum file size (KB)")}
        required
        error={sizeError}
        hint={type ? `${Number.isFinite(sizeKb) && sizeKb > 0 ? `${formatFileSize(sizeKb)}. ` : ""}The most allowed for this document is ${formatFileSize(type.maxSizeKb)} (${type.maxSizeKb} KB).` : tr("1024 KB is 1 MB.")}
      >
        <TextInput type="number" inputMode="numeric" min={MIN_UPLOAD_SIZE_KB} max={type?.maxSizeKb} step={1} value={form.maxSizeKb} onChange={(e) => set("maxSizeKb", e.target.value)} />
      </Field>

      {initial && (
        <Field label={tr("Status")} error={errors.status} hint={tr("Applicants are only asked for active requirements.")}>
          <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as "ACTIVE" | "INACTIVE")}>
            <option value="ACTIVE">{tr("Active")}</option>
            <option value="INACTIVE">{tr("Inactive")}</option>
          </SelectInput>
        </Field>
      )}

      {formError && <FormError>{tr(formError)}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? tr("Saving…") : tr("Save")}
        </PrimaryButton>
        <SecondaryButton onClick={back}>{tr("Cancel")}</SecondaryButton>
      </div>
    </div>
  );
}
