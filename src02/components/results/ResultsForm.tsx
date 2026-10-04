"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { useExamConfiguration, groupByFamily, computeResult, type ExamConfiguration } from "@/lib/examination/mockConfig";

interface ResultEntry {
  id: string;
  qualification: string;
  subject: string;
  value: string; // a grade label, or a numeric score as a string
  /** Set when the applicant recorded a not-graded result (e.g. Absent) instead of a grade. */
  resultTypeId: string;
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function ResultsForm() {
  // Entries live in component state for this session. Qualifications,
  // subjects, grades, pass criteria and result labels all come from the
  // examination parameters administrators manage — the same configuration
  // the Examination Information form uses (src/lib/examination/mockConfig.ts).
  // Result is computed live from Grade/Score using that configuration.
  const exam = useExamConfiguration();
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [qualification, setQualification] = useState("");
  const [subject, setSubject] = useState("");
  const [value, setValue] = useState("");
  const [resultTypeId, setResultTypeId] = useState("");

  const config = qualification ? exam.get(qualification) : undefined;
  const scoreError =
    config?.resultMode === "score" && value.trim() && !isValidScore(value, config.maxScore)
      ? `Enter a score from 0 to ${config.maxScore}.`
      : undefined;
  const livePreview = config && value && !scoreError ? computeResult(config, value) : null;

  function openAddForm() {
    setEditingId(null);
    setQualification("");
    setSubject("");
    setValue("");
    setResultTypeId("");
    setFormOpen(true);
  }

  function openEditForm(entry: ResultEntry) {
    setEditingId(entry.id);
    setQualification(entry.qualification);
    setSubject(entry.subject);
    setValue(entry.value);
    setResultTypeId(entry.resultTypeId);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setQualification("");
    setSubject("");
    setValue("");
    setResultTypeId("");
  }

  function handleQualificationChange(next: string) {
    setQualification(next);
    // Subject pool and grade/score shape both depend on qualification, so
    // clear whatever was chosen for the old one rather than carry over a
    // subject or grade that might not even exist for the new type.
    setSubject("");
    setValue("");
  }

  const canSave = !!qualification && !!subject && (!!resultTypeId || (!!value.trim() && !scoreError));

  function saveResult() {
    if (!canSave) return;
    if (editingId) {
      const patch = { qualification, subject, value: resultTypeId ? "" : value, resultTypeId };
      setResults((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...patch } : r)));
    } else {
      setResults((prev) => [
        ...prev,
        { id: nextId("result"), qualification, subject, value: resultTypeId ? "" : value, resultTypeId },
      ]);
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
                  const rConfig = exam.get(r.qualification);
                  return (
                    <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{rConfig?.qualification ?? r.qualification}</td>
                      <td className="px-5 py-3 text-[var(--color-ink)]">{r.subject}</td>
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                        {r.value || "—"}
                        {r.value && rConfig?.resultMode === "score" ? ` / ${rConfig.maxScore}` : ""}
                      </td>
                      <td className="px-5 py-3">
                        <SavedResult entry={r} exam={exam} />
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
            </Field>

            {config && (
              <Field
                label="Subject"
                required
                hint={config.subjects.length === 0 ? "No subjects are set up for this qualification yet." : undefined}
              >
                <SelectInput value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">Select…</option>
                  {withCurrent(config.subjects, subject).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}

            {/* Not-graded results (Absent, Withheld…) are admin-managed
                result types; choosing one replaces the grade/score. */}
            {config && exam.notGradedTypes.length > 0 && (
              <Field label="Result recorded as">
                <SelectInput value={resultTypeId} onChange={(e) => setResultTypeId(e.target.value)}>
                  <option value="">A {config.resultMode === "grade" ? "grade" : "score"}</option>
                  {exam.notGradedTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                  {resultTypeId && !exam.notGradedTypes.some((t) => t.id === resultTypeId) && (
                    <option value={resultTypeId}>{exam.resultType(resultTypeId)?.label ?? "Retired result type"}</option>
                  )}
                </SelectInput>
              </Field>
            )}

            {/* The field itself changes shape based on examination type:
                a Grade dropdown for GCE levels, a score input for
                BEPC/Probatoire/BAC, out of the type's configured maximum. */}
            {config && !resultTypeId && config.resultMode === "grade" && (
              <Field label="Grade" required>
                <SelectInput value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Select…</option>
                  {withCurrent(config.grades, value).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
            {config && !resultTypeId && config.resultMode === "score" && (
              <Field label={`Score (out of ${config.maxScore})`} required error={scoreError}>
                <TextInput
                  inputMode="numeric"
                  placeholder="e.g. 14"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
            )}

            {config && !resultTypeId && (
              <Field label="Result">
                <div className="flex h-[42px] items-center">
                  {livePreview ? (
                    <ResultBadge tone={livePreview === "Pass" ? "pass" : "fail"} label={exam.resultLabel(livePreview)} />
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

function SavedResult({ entry, exam }: { entry: ResultEntry; exam: ExamConfiguration }) {
  if (entry.resultTypeId) {
    return <ResultBadge tone="neutral" label={exam.resultType(entry.resultTypeId)?.label ?? "Not graded"} />;
  }
  const config = exam.get(entry.qualification);
  if (!config || !entry.value) return null;
  const result = computeResult(config, entry.value);
  return <ResultBadge tone={result === "Pass" ? "pass" : "fail"} label={exam.resultLabel(result)} />;
}

function ResultBadge({ tone, label }: { tone: "pass" | "fail" | "neutral"; label: string }) {
  const classes = {
    pass: "border-[var(--color-success-soft)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    fail: "border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    neutral: "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)]",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${classes}`}>
      {tone === "pass" && <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />}
      {tone === "fail" && <XCircle className="h-3.5 w-3.5" strokeWidth={2} />}
      {label}
    </span>
  );
}

function isValidScore(raw: string, max: number) {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= max;
}

/** Keeps a saved value selectable even if the admin has since retired it. */
function withCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}
