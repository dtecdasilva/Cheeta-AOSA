"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { EXAM_TYPE_CONFIGS, getExamTypeConfig, computeResult } from "@/lib/examination/mockConfig";

interface ResultEntry {
  id: string;
  qualification: string;
  subject: string;
  value: string; // a grade label, or a numeric score (0-20) as a string
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function ResultsForm() {
  // Frontend-only, per spec: entries live in component state for this
  // session and use the same mock examination configuration as the
  // Examination Information module (src/lib/examination/mockConfig.ts).
  // Result is computed live from Grade/Score using that config's pass
  // criteria — that's UI logic on mock data, not backend result
  // processing. Nothing here calls an API or persists past a refresh.
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [qualification, setQualification] = useState("");
  const [subject, setSubject] = useState("");
  const [value, setValue] = useState("");

  const config = getExamTypeConfig(qualification);
  const livePreview = config && value ? computeResult(config, value) : null;

  function openAddForm() {
    setEditingId(null);
    setQualification("");
    setSubject("");
    setValue("");
    setFormOpen(true);
  }

  function openEditForm(entry: ResultEntry) {
    setEditingId(entry.id);
    setQualification(entry.qualification);
    setSubject(entry.subject);
    setValue(entry.value);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setQualification("");
    setSubject("");
    setValue("");
  }

  function handleQualificationChange(next: string) {
    setQualification(next);
    // Subject pool and grade/score shape both depend on qualification, so
    // clear whatever was chosen for the old one rather than carry over a
    // subject or grade that might not even exist for the new type.
    setSubject("");
    setValue("");
  }

  const canSave = !!qualification && !!subject && !!value.trim();

  function saveResult() {
    if (!canSave) return;
    if (editingId) {
      setResults((prev) => prev.map((r) => (r.id === editingId ? { ...r, qualification, subject, value } : r)));
    } else {
      setResults((prev) => [...prev, { id: nextId("result"), qualification, subject, value }]);
    }
    closeForm();
  }

  function deleteResult(id: string) {
    setResults((prev) => prev.filter((r) => r.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* View results */}
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
          <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Your results</p>
          {!formOpen && (
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 border border-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add result
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">
            No results added yet. Use &quot;Add result&quot; to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-ink-faint)]">
                  <th className="px-5 py-2.5 font-normal">Qualification</th>
                  <th className="px-5 py-2.5 font-normal">Subject</th>
                  <th className="px-5 py-2.5 font-normal">Grade</th>
                  <th className="px-5 py-2.5 font-normal">Result</th>
                  <th className="px-5 py-2.5 font-normal">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const rConfig = getExamTypeConfig(r.qualification);
                  const result = rConfig ? computeResult(rConfig, r.value) : null;
                  return (
                    <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.qualification}</td>
                      <td className="px-5 py-3 text-[var(--color-ink)]">{r.subject}</td>
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                        {r.value}
                        {rConfig?.resultMode === "score20" ? " / 20" : ""}
                      </td>
                      <td className="px-5 py-3">
                        {result && <ResultBadge result={result} />}
                      </td>
                      <td className="px-5 py-3">
                        {confirmDeleteId === r.id ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-xs text-[var(--color-ink-soft)]">Remove?</span>
                            <button
                              onClick={() => deleteResult(r.id)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / edit result — dynamic subject/result entry */}
      {formOpen && (
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          <p className="mb-4 font-[var(--font-display)] text-base text-[var(--color-ink)]">
            {editingId ? "Edit result" : "Add a result"}
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
              <Field label="Subject" required>
                <SelectInput value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">Select…</option>
                  {config.subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}

            {/* The field itself changes shape based on examination type:
                a Grade dropdown for GCE levels, a Score /20 input for
                BEPC/Probatoire/BAC. */}
            {config && config.resultMode === "grade" && (
              <Field label="Grade" required>
                <SelectInput value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Select…</option>
                  {config.grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
            {config && config.resultMode === "score20" && (
              <Field label="Score (out of 20)" required>
                <TextInput
                  inputMode="numeric"
                  placeholder="e.g. 14"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
            )}

            {config && (
              <Field label="Result">
                <div className="flex h-[42px] items-center">
                  {livePreview ? (
                    <ResultBadge result={livePreview} />
                  ) : (
                    <span className="text-sm text-[var(--color-ink-faint)]">
                      Enter a {config.resultMode === "grade" ? "grade" : "score"} to see the result
                    </span>
                  )}
                </div>
              </Field>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
            <SecondaryButton type="button" onClick={closeForm}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="button" onClick={saveResult} disabled={!canSave}>
              Save
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: "Pass" | "Fail" }) {
  const pass = result === "Pass";
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${
        pass
          ? "border-[var(--color-success-soft)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
          : "border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
      }`}
    >
      {pass ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> : <XCircle className="h-3.5 w-3.5" strokeWidth={2} />}
      {result}
    </span>
  );
}
