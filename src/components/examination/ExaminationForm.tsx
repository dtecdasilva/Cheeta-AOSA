"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { EXAM_TYPE_CONFIGS, getExamTypeConfig } from "@/lib/examination/mockConfig";

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

export function ExaminationForm() {
  // This module is frontend-only, per spec: entries live in component
  // state for this session and use mock configuration data
  // (src/lib/examination/mockConfig.ts) — nothing here calls an API or
  // persists past a page refresh. A later module wires this to real,
  // database-backed configuration and storage.
  const [records, setRecords] = useState<ExaminationRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [qualification, setQualification] = useState("");
  const [sittings, setSittings] = useState<Sitting[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const config = getExamTypeConfig(qualification);

  function openAddForm() {
    setEditingId(null);
    setQualification("");
    setSittings([]);
    setFormOpen(true);
  }

  function openEditForm(record: ExaminationRecord) {
    setEditingId(record.id);
    setQualification(record.qualification);
    setSittings(record.sittings);
    setFormOpen(true);
  }

  function closeForm() {
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
    const next = getExamTypeConfig(value);
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

  function saveRecord() {
    if (!canSave) return;
    if (editingId) {
      setRecords((prev) => prev.map((r) => (r.id === editingId ? { ...r, qualification, sittings } : r)));
    } else {
      setRecords((prev) => [...prev, { id: nextId("exam"), qualification, sittings }]);
    }
    closeForm();
  }

  function deleteRecord(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Saved records table */}
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
          <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Your examinations</p>
          {!formOpen && (
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 border border-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add examination
            </button>
          )}
        </div>

        {records.length === 0 ? (
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
                    <td className="px-5 py-3 text-[var(--color-ink)]">{r.qualification}</td>
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
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          <p className="mb-4 font-[var(--font-display)] text-base text-[var(--color-ink)]">
            {editingId ? "Edit examination" : "Add an examination"}
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Qualification" required>
              <SelectInput value={qualification} onChange={(e) => handleQualificationChange(e.target.value)}>
                <option value="">Select…</option>
                {EXAM_TYPE_CONFIGS.map((c) => (
                  <option key={c.qualification} value={c.qualification}>
                    {c.qualification}
                  </option>
                ))}
              </SelectInput>
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
              </Field>
            )}
          </div>

          {/* One block per sitting — this is what changes based on
              "Number of sittings" per the spec. */}
          {config &&
            sittings.map((sitting, i) => (
              <div key={sitting.id} className="mt-5 border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
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
                  </Field>
                  <Field label="Candidate number" required>
                    <TextInput
                      value={sitting.candidateNumber}
                      onChange={(e) => updateSitting(sitting.id, "candidateNumber", e.target.value)}
                    />
                  </Field>
                  <Field label="Centre number" required>
                    <TextInput
                      value={sitting.centreNumber}
                      onChange={(e) => updateSitting(sitting.id, "centreNumber", e.target.value)}
                    />
                  </Field>
                </div>

                {/* Subject entry — shape depends on the qualification's
                    result mode: letter grade vs. a score out of 20. This
                    is the other axis of "dynamic based on examination
                    type", alongside the sitting count above. */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[var(--color-ink-soft)]">
                      Subjects &amp; {config.resultMode === "grade" ? "grades" : "scores (out of 20)"}
                    </p>
                    <button
                      onClick={() => addSubjectEntry(sitting.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink)] underline underline-offset-4"
                    >
                      <Plus className="h-3 w-3" strokeWidth={2.5} />
                      Add subject
                    </button>
                  </div>

                  {sitting.subjectEntries.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {sitting.subjectEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2">
                          <SelectInput
                            value={entry.subject}
                            onChange={(e) => updateSubjectEntry(sitting.id, entry.id, { subject: e.target.value })}
                          >
                            <option value="">Select subject…</option>
                            {config.subjects.map((s) => (
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
                                {config.grades.map((g) => (
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
                                placeholder="/20"
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
            <PrimaryButton type="button" onClick={saveRecord} disabled={!canSave}>
              Save
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
