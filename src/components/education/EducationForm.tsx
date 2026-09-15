"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { CountrySelect } from "@/components/CountrySelect";
import { EducationLevelConfig } from "@/lib/education/configTypes";
import { EducationRecord, EducationRecordInput } from "@/lib/education/types";

type FormState = Partial<EducationRecordInput>;
type FieldErrors = Partial<Record<keyof EducationRecordInput, string>>;

const EMPTY_FORM: FormState = { startYear: "", endYear: "", schoolName: "", country: "", schoolType: "", qualification: "" };

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--color-danger)]">{message}</p>;
}

/** Client-side mirror of the server's validation rules — the source of
 * truth for *what's valid* still comes entirely from the fetched `levels`
 * data (never a hard-coded list); this just avoids a round trip for
 * obvious mistakes. The server re-validates everything regardless. */
function validateClientSide(form: FormState, levels: EducationLevelConfig[]): FieldErrors {
  const errors: FieldErrors = {};
  const currentYear = new Date().getFullYear();
  const level = levels.find((l) => l.name === form.schoolType);

  if (!form.schoolName?.trim()) errors.schoolName = "School name is required.";
  if (!form.country) errors.country = "Select the country the school is in.";
  if (!form.schoolType) errors.schoolType = "Select a school type.";
  if (!form.qualification) {
    errors.qualification = "Select a qualification.";
  } else if (level && !level.qualifications.some((q) => q.label === form.qualification)) {
    errors.qualification = "Select a qualification that's valid for the chosen school type.";
  }

  const startYear = form.startYear ? Number(form.startYear) : NaN;
  const endYear = form.endYear ? Number(form.endYear) : NaN;

  if (!form.startYear) errors.startYear = "Start year is required.";
  else if (!/^\d{4}$/.test(form.startYear) || startYear > currentYear + 1) {
    errors.startYear = "Enter a valid year.";
  }
  if (!form.endYear) errors.endYear = "End year is required.";
  else if (!/^\d{4}$/.test(form.endYear) || endYear > currentYear + 1) {
    errors.endYear = "Enter a valid year.";
  }
  if (!errors.startYear && !errors.endYear && endYear < startYear) {
    errors.endYear = "End year cannot be before start year.";
  }

  return errors;
}

export function EducationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<EducationLevelConfig[]>([]);
  const [records, setRecords] = useState<EducationRecord[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [levelsRes, recordsRes] = await Promise.all([
          fetch("/api/config/education-levels", { cache: "no-store" }),
          fetch("/api/student/education", { cache: "no-store" }),
        ]);
        const levelsData = await levelsRes.json();
        const recordsData = await recordsRes.json();
        if (cancelled) return;
        if (levelsRes.ok) setLevels(levelsData.levels);
        if (recordsRes.ok) setRecords(recordsData.records);
        if (!levelsRes.ok || !recordsRes.ok) {
          setFormError("Could not load your education information.");
        }
      } catch {
        if (!cancelled) setFormError("Could not load your education information. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const qualificationOptions = useMemo(() => {
    return levels.find((l) => l.name === form.schoolType)?.qualifications ?? [];
  }, [levels, form.schoolType]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "schoolType") next.qualification = "";
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEditForm(record: EducationRecord) {
    setEditingId(record.id);
    setForm({
      startYear: record.startYear,
      endYear: record.endYear,
      schoolName: record.schoolName,
      country: record.country,
      schoolType: record.schoolType,
      qualification: record.qualification,
    });
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  async function saveRecord() {
    setFormError(null);
    const clientErrors = validateClientSide(form, levels);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError("Some fields need attention before this can be saved.");
      return;
    }

    setSaving(true);
    try {
      const isEdit = editingId !== null;
      const res = await fetch(isEdit ? `/api/student/education/${editingId}` : "/api/student/education", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setFormError(data.error ?? "Could not save this school.");
        return;
      }

      setRecords((prev) => {
        if (isEdit) return prev.map((r) => (r.id === data.record.id ? data.record : r));
        return [...prev, data.record];
      });
      setSuccessMessage(isEdit ? "School updated." : "School added.");
      setContinueError(null);
      closeForm();
    } catch {
      setFormError("Could not save this school. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    try {
      const res = await fetch(`/api/student/education/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setSuccessMessage("School removed.");
      }
    } finally {
      setConfirmDeleteId(null);
    }
  }

  function handleContinue() {
    if (records.length === 0) {
      setContinueError("Add at least one education record before continuing.");
      return;
    }
    router.push("/student/application/summary");
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Loading your education information…</p>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      {successMessage && !formOpen && (
        <p className="flex items-center gap-2 border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-2.5 text-sm text-[var(--color-success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
          {successMessage}
        </p>
      )}

      {/* Saved records table */}
      <div className="border border-[var(--color-line)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
          <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Your schools</p>
          {!formOpen && (
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 border border-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add another school
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">
            No schools added yet. Use &quot;Add another school&quot; to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-ink-faint)]">
                  <th className="px-5 py-2.5 font-normal">Start</th>
                  <th className="px-5 py-2.5 font-normal">End</th>
                  <th className="px-5 py-2.5 font-normal">School name</th>
                  <th className="px-5 py-2.5 font-normal">Country</th>
                  <th className="px-5 py-2.5 font-normal">School type</th>
                  <th className="px-5 py-2.5 font-normal">Qualification</th>
                  <th className="px-5 py-2.5 font-normal">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.startYear}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.endYear}</td>
                    <td className="px-5 py-3 text-[var(--color-ink)]">{r.schoolName}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.country}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.schoolType}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.qualification}</td>
                    <td className="px-5 py-3">
                      {confirmDeleteId === r.id ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-xs text-[var(--color-ink-soft)]">Remove this school?</span>
                          <button
                            onClick={() => confirmDelete(r.id)}
                            className="text-xs font-medium text-[var(--color-danger)] underline underline-offset-4"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs font-medium text-[var(--color-ink-soft)] underline underline-offset-4"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <button
                            onClick={() => openEditForm(r)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink)] hover:underline"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={2} />
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(r.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger)] hover:underline"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={2} />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / edit form */}
      {formOpen && (
        <div className="border border-[var(--color-line)] bg-white p-5 sm:p-6">
          <p className="mb-4 font-[var(--font-display)] text-base text-[var(--color-ink)]">
            {editingId ? "Edit school" : "Add a school"}
          </p>

          {formError && (
            <p role="alert" className="mb-4 border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
              {formError}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Start year" required>
              <TextInput
                inputMode="numeric"
                placeholder="e.g. 2015"
                value={form.startYear ?? ""}
                onChange={(e) => update("startYear", e.target.value)}
              />
              <ErrorText message={errors.startYear} />
            </Field>
            <Field label="End year" required>
              <TextInput
                inputMode="numeric"
                placeholder="e.g. 2019"
                value={form.endYear ?? ""}
                onChange={(e) => update("endYear", e.target.value)}
              />
              <ErrorText message={errors.endYear} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="School name" required>
                <TextInput value={form.schoolName ?? ""} onChange={(e) => update("schoolName", e.target.value)} />
                <ErrorText message={errors.schoolName} />
              </Field>
            </div>
            <CountrySelect
              label="Country"
              required
              value={form.country ?? ""}
              onChange={(v) => update("country", v)}
              error={errors.country}
            />
            <Field label="School type" required>
              <SelectInput value={form.schoolType ?? ""} onChange={(e) => update("schoolType", e.target.value)}>
                <option value="">Select…</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </SelectInput>
              <ErrorText message={errors.schoolType} />
            </Field>
            <Field label="Qualification obtained" required hint={!form.schoolType ? "Select a school type first." : undefined}>
              <SelectInput
                value={form.qualification ?? ""}
                onChange={(e) => update("qualification", e.target.value)}
                disabled={!form.schoolType}
              >
                <option value="">Select…</option>
                {qualificationOptions.map((q) => (
                  <option key={q.id} value={q.label}>
                    {q.label}
                  </option>
                ))}
              </SelectInput>
              <ErrorText message={errors.qualification} />
            </Field>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
            <SecondaryButton type="button" onClick={closeForm} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="button" onClick={saveRecord} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* Section-level continue */}
      <div className="border-t border-[var(--color-line)] pt-6">
        {continueError && <p className="mb-3 text-sm text-[var(--color-danger)]">{continueError}</p>}
        <PrimaryButton type="button" onClick={handleContinue}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}
