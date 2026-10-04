"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { useExamConfiguration, groupByFamily } from "@/lib/examination/mockConfig";

interface SubjectEntry {
  id: string;
  subject: string;
  value: string; // a grade label, or a numeric score (0-20) as a string
}

interface Sitting {
  id: string;
  examinationYear: string;
  candidateNumber: string;
  centreNumber: string;
  subjectEntries: SubjectEntry[];
}

interface ExaminationRecord {
  id: string;
  qualification: string;
  sittings: Sitting[];
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function blankSitting(): Sitting {
  return { id: nextId("sitting"), examinationYear: "", candidateNumber: "", centreNumber: "", subjectEntries: [] };
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--color-danger)]">{message}</p>;
}

export function ExaminationForm() {
  // Records are the applicant's own, kept by the API (/api/student/examinations).
  // Qualifications, subjects, grades and sitting limits all come from the
  // examination parameters administrators manage, served by
  // /api/config/examinations — none are written into this form.
  // `qualification` holds the configured type's id. The server checks every
  // save against that configuration and reports problems field by field.
  const exam = useExamConfiguration();
  const [records, setRecords] = useState<ExaminationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/examinations", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) setRecords(data.records);
        else setListError(data.error ?? "Could not load your examinations.");
      })
      .catch(() => !cancelled && setListError("Could not load your examinations. Check your connection."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [qualification, setQualification] = useState("");
  const [sittings, setSittings] = useState<Sitting[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const config = qualification ? exam.get(qualification) : undefined;

  function clearProblems() {
    setFormError(null);
    setErrors({});
  }

  function openAddForm() {
    clearProblems();
    setEditingId(null);
    setQualification("");
    setSittings([]);
    setFormOpen(true);
  }

  function openEditForm(record: ExaminationRecord) {
    clearProblems();
    setEditingId(record.id);
    setQualification(record.qualification);
    setSittings(record.sittings);
    setFormOpen(true);
  }

  function closeForm() {
    clearProblems();
    setFormOpen(false);
    setEditingId(null);
    setQualification("");
    setSittings([]);
  }

  function handleQualificationChange(value: string) {
    setQualification(value);
    // Different qualifications have different result shapes (letter
    // grades vs. a score out of 20) and subject pools, so switching type
    // starts sittings fresh rather than carrying over mismatched data.
    const next = value ? exam.get(value) : undefined;
    if (!next) {
      setSittings([]);
      return;
    }
    setSittings(Array.from({ length: next.defaultSittings }, () => blankSitting()));
  }

  function setSittingCount(count: number) {
    setSittings((prev) => {
      if (count <= prev.length) return prev.slice(0, count);
      return [...prev, ...Array.from({ length: count - prev.length }, () => blankSitting())];
    });
  }

  function updateSitting<K extends keyof Sitting>(sittingId: string, key: K, value: Sitting[K]) {
    setSittings((prev) => prev.map((s) => (s.id === sittingId ? { ...s, [key]: value } : s)));
  }

  function addSubjectEntry(sittingId: string) {
    setSittings((prev) =>
      prev.map((s) =>
        s.id === sittingId
          ? { ...s, subjectEntries: [...s.subjectEntries, { id: nextId("subj"), subject: "", value: "" }] }
          : s
      )
    );
  }

  function updateSubjectEntry(sittingId: string, entryId: string, patch: Partial<SubjectEntry>) {
    setSittings((prev) =>
      prev.map((s) =>
        s.id !== sittingId
          ? s
          : {
              ...s,
              subjectEntries: s.subjectEntries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
            }
      )
    );
  }

  function removeSubjectEntry(sittingId: string, entryId: string) {
    setSittings((prev) =>
      prev.map((s) =>
        s.id !== sittingId ? s : { ...s, subjectEntries: s.subjectEntries.filter((e) => e.id !== entryId) }
      )
    );
  }

  const canSave =
    !!qualification &&
    sittings.length > 0 &&
    sittings.every((s) => s.examinationYear.trim() && s.candidateNumber.trim() && s.centreNumber.trim());

  async function saveRecord() {
    if (!canSave || saving) return;
    clearProblems();
    // Rows added and left empty aren't entries. Dropping them here keeps this
    // form's row numbers in step with the ones the server reports problems against.
    const cleaned = sittings.map((st) => ({ ...st, subjectEntries: st.subjectEntries.filter((e) => e.subject || e.value.trim()) }));
    setSittings(cleaned);

    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/student/examinations/${editingId}` : "/api/student/examinations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualification,
          sittings: cleaned.map((st) => ({
            examinationYear: st.examinationYear,
            candidateNumber: st.candidateNumber,
            centreNumber: st.centreNumber,
            subjectEntries: st.subjectEntries.map((e) => ({ subject: e.subject, value: e.value })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setFormError(data.error ?? "Could not save this examination.");
        return;
      }
      const saved: ExaminationRecord = data.record;
      setRecords((prev) => (editingId ? prev.map((r) => (r.id === editingId ? saved : r)) : [...prev, saved]));
      closeForm();
    } catch {
      setFormError("Could not save this examination. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(id: string) {
    setListError(null);
    try {
      const res = await fetch(`/api/student/examinations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setListError(data.error ?? "Could not remove this examination.");
      } else {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        if (editingId === id) closeForm();
      }
    } catch {
      setListError("Could not remove this examination. Check your connection and try again.");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Saved records table */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
          <p className="font-semibold text-base text-[var(--color-ink)]">Your examinations</p>
          {!formOpen && (
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add examination
            </button>
          )}
        </div>

        {listError && (
          <p role="alert" className="border-b border-[var(--color-line)] bg-[var(--color-danger-soft)] px-5 py-2.5 text-sm text-[var(--color-danger-strong)]">
            {listError}
          </p>
        )}

        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">Loading your examinations…</p>
        ) : records.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">
            No examinations added yet. Use &quot;Add examination&quot; to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-ink-faint)]">
                  <th className="px-5 py-2.5 font-normal">Qualification</th>
                  <th className="px-5 py-2.5 font-normal">Sittings</th>
                  <th className="px-5 py-2.5 font-normal">Year(s)</th>
                  <th className="px-5 py-2.5 font-normal">Candidate no.</th>
                  <th className="px-5 py-2.5 font-normal">Centre no.</th>
                  <th className="px-5 py-2.5 font-normal">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0 align-top">
                    <td className="px-5 py-3 text-[var(--color-ink)]">{exam.get(r.qualification)?.qualification ?? r.qualification}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.sittings.length}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                      {r.sittings.map((s) => s.examinationYear).join(", ")}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                      {r.sittings.map((s) => s.candidateNumber).join(", ")}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                      {r.sittings.map((s) => s.centreNumber).join(", ")}
                    </td>
                    <td className="px-5 py-3">
                      {confirmDeleteId === r.id ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-xs text-[var(--color-ink-soft)]">Remove?</span>
                          <button
                            onClick={() => deleteRecord(r.id)}
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
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          <p className="mb-4 font-semibold text-base text-[var(--color-ink)]">
            {editingId ? "Edit examination" : "Add an examination"}
          </p>

          {formError && (
            <p role="alert" className="mb-4 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-strong)]">
              {formError}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Qualification" required>
              <SelectInput value={qualification} onChange={(e) => handleQualificationChange(e.target.value)}>
                <option value="">Select…</option>
                {groupByFamily(exam.types).map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.types.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.qualification}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {config && !config.active && (
                  <option value={config.id}>{config.qualification} (no longer offered)</option>
                )}
              </SelectInput>
              <ErrorText message={errors.qualification} />
            </Field>

            {config && (
              <Field label="Number of sittings" required hint={`Up to ${config.maxSittings} for this qualification.`}>
                <SelectInput value={String(sittings.length)} onChange={(e) => setSittingCount(Number(e.target.value))}>
                  {Array.from({ length: config.maxSittings }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </SelectInput>
                <ErrorText message={errors.sittings} />
              </Field>
            )}
          </div>

          {/* One block per sitting — this is what changes based on
              "Number of sittings" per the spec. */}
          {config &&
            sittings.map((sitting, i) => (
              <div key={sitting.id} className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
                <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">
                  Sitting {i + 1}
                  {sittings.length > 1 ? ` of ${sittings.length}` : ""}
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Examination year" required>
                    <TextInput
                      inputMode="numeric"
                      placeholder="e.g. 2023"
                      value={sitting.examinationYear}
                      onChange={(e) => updateSitting(sitting.id, "examinationYear", e.target.value)}
                    />
                    <ErrorText message={errors[`sittings.${i}.examinationYear`]} />
                  </Field>
                  <Field label="Candidate number" required>
                    <TextInput
                      value={sitting.candidateNumber}
                      onChange={(e) => updateSitting(sitting.id, "candidateNumber", e.target.value)}
                    />
                    <ErrorText message={errors[`sittings.${i}.candidateNumber`]} />
                  </Field>
                  <Field label="Centre number" required>
                    <TextInput
                      value={sitting.centreNumber}
                      onChange={(e) => updateSitting(sitting.id, "centreNumber", e.target.value)}
                    />
                    <ErrorText message={errors[`sittings.${i}.centreNumber`]} />
                  </Field>
                </div>

                {/* Subject entry — shape depends on the qualification's
                    result mode: letter grade vs. a score out of 20. This
                    is the other axis of "dynamic based on examination
                    type", alongside the sitting count above. */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[var(--color-ink-soft)]">
                      Subjects &amp; {config.resultMode === "grade" ? "grades" : `scores (out of ${config.maxScore})`}
                    </p>
                    <button
                      onClick={() => addSubjectEntry(sitting.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink)] underline underline-offset-4"
                    >
                      <Plus className="h-3 w-3" strokeWidth={2.5} />
                      Add subject
                    </button>
                  </div>

                  {config.subjects.length === 0 && (
                    <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
                      No subjects are set up for this qualification yet. An administrator can add them under
                      Examination parameters.
                    </p>
                  )}

                  {sitting.subjectEntries.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {sitting.subjectEntries.map((entry, j) => (
                        <div key={entry.id}>
                        <div className="flex items-center gap-2">
                          <SelectInput
                            value={entry.subject}
                            onChange={(e) => updateSubjectEntry(sitting.id, entry.id, { subject: e.target.value })}
                          >
                            <option value="">Select subject…</option>
                            {withCurrent(config.subjects, entry.subject).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </SelectInput>

                          {config.resultMode === "grade" ? (
                            <div className="w-28 shrink-0">
                              <SelectInput
                                value={entry.value}
                                onChange={(e) => updateSubjectEntry(sitting.id, entry.id, { value: e.target.value })}
                              >
                                <option value="">Grade…</option>
                                {withCurrent(config.grades, entry.value).map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </SelectInput>
                            </div>
                          ) : (
                            <div className="w-20 shrink-0">
                              <TextInput
                                inputMode="numeric"
                                placeholder={`/${config.maxScore}`}
                                value={entry.value}
                                onChange={(e) => updateSubjectEntry(sitting.id, entry.id, { value: e.target.value })}
                              />
                            </div>
                          )}

                          <button
                            onClick={() => removeSubjectEntry(sitting.id, entry.id)}
                            aria-label="Remove subject"
                            className="text-[var(--color-danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </div>
                        <ErrorText message={errors[`sittings.${i}.subjectEntries.${j}.subject`] ?? errors[`sittings.${i}.subjectEntries.${j}.value`]} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

          <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
            <SecondaryButton type="button" onClick={closeForm}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="button" onClick={saveRecord} disabled={!canSave || saving}>
              {saving ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** Keeps a saved value selectable even if the admin has since retired it. */
function withCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}
