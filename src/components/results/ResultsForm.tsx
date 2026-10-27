"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { useExamConfiguration, computeResult, type ExamConfiguration, type ExamTypeConfig } from "@/lib/examination/mockConfig";
import { sittingLabel, type ExaminationView, type ResultView, type SittingView } from "@/lib/examination/records";
import { buttonClass } from "@/lib/ui/button";
import { useT } from "@/lib/i18n/client";

const EXAMINATIONS_HREF = "/student/application/examinations";

/** One entry of the examination dropdown: a sitting of an examination the applicant created. */
interface Choice {
  sittingId: string;
  label: string;
  sitting: SittingView;
  /** The qualification's configuration; undefined if it has since been removed. */
  config: ExamTypeConfig | undefined;
}

export function ResultsForm({ examination }: { examination?: string }) {
  const tr = useT();
  // Results are added to an examination the applicant has already created
  // on the Examinations Information form: it is picked from the dropdown
  // here, and the subjects and grades offered are that examination's.
  // Nothing on this form creates an examination or names a qualification
  // of its own.
  //
  // Examinations come from /api/student/examinations and results from
  // /api/student/results. Subjects, grades, pass criteria and result
  // labels come from the examination parameters administrators manage
  // (/api/config/examinations). The Result shown while typing is worked
  // out here from that configuration; the server checks every save.
  const exam = useExamConfiguration();
  const [examinations, setExaminations] = useState<ExaminationView[]>([]);
  const [results, setResults] = useState<ResultView[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [chosen, setChosen] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [value, setValue] = useState("");
  const [resultTypeId, setResultTypeId] = useState("");
  /** The subject just saved, shown while the form stays open for the next one. */
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/student/examinations", { cache: "no-store" }), fetch("/api/student/results", { cache: "no-store" })])
      .then(async ([examRes, resultRes]) => {
        const [examData, resultData] = [await examRes.json(), await resultRes.json()];
        if (cancelled) return;
        if (!examRes.ok || !resultRes.ok) return setListError(examData.error ?? resultData.error ?? tr("Could not load your results."));
        setExaminations(examData.records);
        setResults(resultData.results);
      })
      .catch(() => !cancelled && setListError(tr("Could not load your results. Check your connection.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const choices: Choice[] = useMemo(
    () =>
      examinations.flatMap((e) => {
        const config = exam.get(e.qualification);
        return e.sittings.map((sitting) => ({ sittingId: sitting.id, label: sittingLabel(config?.qualification ?? e.qualification, sitting, e.sittings.length), sitting, config }));
      }),
    [examinations, exam]
  );
  // The examination asked for in the link, or the one picked here, or the first.
  const choice = choices.find((c) => c.sittingId === (chosen ?? examination)) ?? choices[0];
  const config = choice?.config;
  const own = choice ? results.filter((r) => r.sittingId === choice.sittingId) : [];
  const unattached = results.filter((r) => !r.sittingId);
  const editing = editingId ? results.find((r) => r.id === editingId) : undefined;

  const scoreError = config?.resultMode === "score" && value.trim() && !isValidScore(value, config.maxScore) ? tr("Enter a score from 0 to {maxScore}.", { maxScore: config.maxScore }) : undefined;
  const livePreview = config && value && !scoreError ? computeResult(config, value) : null;
  // A subject already recorded for this examination isn't offered again.
  const taken = new Set(own.filter((r) => r.id !== editingId).map((r) => r.subject));
  const subjectOptions = config ? withCurrent(config.subjects.filter((s) => !taken.has(s)), subject) : [];

  function clearProblems() {
    setFormError(null);
    setErrors({});
  }

  function resetFields() {
    setSubject("");
    setValue("");
    setResultTypeId("");
  }

  function openAddForm() {
    clearProblems();
    setEditingId(null);
    resetFields();
    setLastSaved(null);
    setFormOpen(true);
  }

  function openEditForm(entry: ResultView) {
    clearProblems();
    setEditingId(entry.id);
    setSubject(entry.subject);
    setValue(entry.value);
    setResultTypeId(entry.resultTypeId);
    setLastSaved(null);
    setFormOpen(true);
  }

  function closeForm() {
    clearProblems();
    setFormOpen(false);
    setEditingId(null);
    resetFields();
    setLastSaved(null);
  }

  function chooseExamination(sittingId: string) {
    // The subjects and grades on offer belong to the examination, so a form half filled in for another one is closed.
    closeForm();
    setConfirmDeleteId(null);
    setChosen(sittingId);
  }

  const canSave = !!choice && !!config && !!subject && (!!resultTypeId || (!!value.trim() && !scoreError));

  async function saveResult() {
    if (!canSave || saving || !choice) return;
    clearProblems();
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/student/results/${editingId}` : "/api/student/results", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sittingId: choice.sittingId, subject, value: resultTypeId ? "" : value, resultTypeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setFormError(data.fieldErrors?.sittingId ?? data.error ?? tr("Could not save this result."));
        return;
      }
      const saved: ResultView = data.result;
      setResults((prev) => (editingId ? prev.map((r) => (r.id === editingId ? saved : r)) : [...prev, saved]));
      if (editingId) closeForm();
      else {
        // Results are entered one subject after another, so the form stays open, ready for the next.
        resetFields();
        setLastSaved(saved.subject);
      }
    } catch {
      setFormError(tr("Could not save this result. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteResult(id: string) {
    setListError(null);
    try {
      const res = await fetch(`/api/student/results/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setListError(data.error ?? tr("Could not remove this result."));
      } else {
        setResults((prev) => prev.filter((r) => r.id !== id));
        if (editingId === id) closeForm();
      }
    } catch {
      setListError(tr("Could not remove this result. Check your connection and try again."));
    } finally {
      setConfirmDeleteId(null);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading your results…")}</p>;

  if (choices.length === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        {listError && <Alert>{tr(listError)}</Alert>}
        <div className="rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[var(--color-ink)]">{tr("Add your examination first")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-ink-soft)]">
            {tr("Results are recorded against an examination you have added. Create the examination under Examinations Information, then come back here to add the results you obtained in it.")}
          </p>
          <div className="mt-4 flex justify-center">
            <Link href={EXAMINATIONS_HREF} className={buttonClass("primary")}>
              {tr("Add an examination")}
            </Link>
          </div>
        </div>
        {unattached.length > 0 && <Unattached results={unattached} exam={exam} canAttach={false} onEdit={openEditForm} onDelete={deleteResult} />}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Which examination */}
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <Field label={tr("Examination")} hint={tr("The examinations you added under Examinations Information.")}>
          <SelectInput value={choice.sittingId} onChange={(e) => chooseExamination(e.target.value)}>
            {choices.map((c) => (
              <option key={c.sittingId} value={c.sittingId}>
                {tr(c.label)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {[
            [tr("Examination year"), choice.sitting.examinationYear],
            [tr("Candidate number"), choice.sitting.candidateNumber],
            [tr("Centre number"), choice.sitting.centreNumber],
          ].map(([label, text]) => (
            <div key={label}>
              <dt className="text-xs text-[var(--color-ink-faint)]">{tr(label)}</dt>
              <dd className="text-[var(--color-ink)]">{tr(text)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-[var(--color-ink-faint)]">
          {tr("Not in the list?")}{" "}
          <Link href={EXAMINATIONS_HREF} className="underline underline-offset-4">
            {tr("Add the examination")}
          </Link>{" "}{tr("first, then record its results here.")}
        </p>
      </div>

      {/* The results recorded for it */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
          <div className="min-w-0">
            <p className="font-semibold text-base text-[var(--color-ink)]">{tr("Results")}</p>
            <p className="truncate text-xs text-[var(--color-ink-soft)]">{tr(choice.label)}</p>
          </div>
          {!formOpen && config && (
            <button
              onClick={openAddForm}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              {tr("Add result")}
            </button>
          )}
        </div>

        {listError && <Alert flush>{tr(listError)}</Alert>}
        {!config && <Alert flush>{tr("This examination's qualification is no longer set up, so results can't be added to it.")}</Alert>}

        {own.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">{tr("No results recorded for this examination yet. Use \"Add result\" to add the subjects and grades you obtained.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-ink-faint)]">
                  <th className="px-5 py-2.5 font-normal">{tr("Subject")}</th>
                  <th className="px-5 py-2.5 font-normal">{config?.resultMode === "score" ? tr("Score") : tr("Grade")}</th>
                  <th className="px-5 py-2.5 font-normal">{tr("Result")}</th>
                  <th className="px-5 py-2.5 font-normal">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {own.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-5 py-3 text-[var(--color-ink)]">{tr(r.subject)}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                      {r.value || "—"}
                      {r.value && config?.resultMode === "score" ? ` / ${config.maxScore}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <SavedResult entry={r} exam={exam} />
                    </td>
                    <td className="px-5 py-3">
                      <RowActions confirming={confirmDeleteId === r.id} onEdit={() => openEditForm(r)} onAskDelete={() => setConfirmDeleteId(r.id)} onCancelDelete={() => setConfirmDeleteId(null)} onDelete={() => deleteResult(r.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / edit a result of the chosen examination */}
      {formOpen && config && (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          <p className="font-semibold text-base text-[var(--color-ink)]">{editingId ? tr("Edit result") : tr("Add a result")}</p>
          <p className="mb-4 mt-0.5 text-xs text-[var(--color-ink-soft)]">
            {editing && !editing.sittingId ? tr("This result will be added to {label}.", { label: tr(choice.label) }) : choice.label}
          </p>

          {lastSaved && !formError && (
            <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
              {tr("{lastSaved} saved. Add the next subject, or close when you have finished.", { lastSaved })}
            </p>
          )}
          {formError && <Alert>{tr(formError)}</Alert>}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("Subject")} required error={errors.subject} hint={config.subjects.length === 0 ? tr("No subjects are set up for this examination yet.") : subjectOptions.length === 0 ? tr("Every subject of this examination has a result recorded.") : undefined}>
              <SelectInput value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">{tr("Select…")}</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>
                    {tr(s)}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {/* Not-graded results (Absent, Withheld…) are admin-managed
                result types; choosing one replaces the grade/score. */}
            {exam.notGradedTypes.length > 0 && (
              <Field label={tr("Result recorded as")} error={errors.resultTypeId}>
                <SelectInput value={resultTypeId} onChange={(e) => setResultTypeId(e.target.value)}>
                  <option value="">A {config.resultMode === "grade" ? "grade" : "score"}</option>
                  {exam.notGradedTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {tr(t.label)}
                    </option>
                  ))}
                  {resultTypeId && !exam.notGradedTypes.some((t) => t.id === resultTypeId) && <option value={resultTypeId}>{exam.resultType(resultTypeId)?.label ?? tr("Retired result type")}</option>}
                </SelectInput>
              </Field>
            )}

            {/* The field changes shape with the examination: a Grade
                dropdown for GCE levels, a score input for BEPC/Probatoire/BAC,
                out of the type's configured maximum. */}
            {!resultTypeId && config.resultMode === "grade" && (
              <Field label={tr("Grade")} required error={errors.value}>
                <SelectInput value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">{tr("Select…")}</option>
                  {withCurrent(config.grades, value).map((g) => (
                    <option key={g} value={g}>
                      {tr(g)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
            {!resultTypeId && config.resultMode === "score" && (
              <Field label={tr("Score (out of {maxScore})", { maxScore: config.maxScore })} required error={scoreError ?? errors.value}>
                <TextInput inputMode="numeric" placeholder="e.g. 14" value={value} onChange={(e) => setValue(e.target.value)} />
              </Field>
            )}

            {!resultTypeId && (
              <Field label={tr("Result")}>
                <div className="flex h-[42px] items-center">
                  {livePreview ? (
                    <ResultBadge tone={livePreview === "Pass" ? "pass" : "fail"} label={exam.resultLabel(livePreview)} />
                  ) : (
                    <span className="text-sm text-[var(--color-ink-faint)]">{tr("Enter a")}{" "}{config.resultMode === "grade" ? "grade" : "score"}{" "}{tr("to see the result")}</span>
                  )}
                </div>
              </Field>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
            <SecondaryButton type="button" onClick={closeForm}>
              {lastSaved ? tr("Close") : tr("Cancel")}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={saveResult} disabled={!canSave || saving}>
              {saving ? tr("Saving…") : tr("Save")}
            </PrimaryButton>
          </div>
        </div>
      )}

      {unattached.length > 0 && <Unattached results={unattached} exam={exam} canAttach={!!config} attachTo={choice.label} onEdit={openEditForm} onDelete={deleteResult} />}
    </div>
  );
}

/**
 * Results recorded before results were tied to an examination, for a
 * qualification the applicant never created an examination for. They are
 * shown so nothing is lost: each can be added to the examination chosen
 * above (Edit, then Save), or removed.
 */
function Unattached({ results, exam, canAttach, attachTo, onEdit, onDelete }: { results: ResultView[]; exam: ExamConfiguration; canAttach: boolean; attachTo?: string; onEdit: (r: ResultView) => void; onDelete: (id: string) => void }) {
  const tr = useT();
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-line)] bg-[var(--color-warning-soft)] px-5 py-3">
        <p className="text-sm font-semibold text-[var(--color-warning-strong)]">{tr("Results not linked to an examination")}</p>
        <p className="mt-0.5 text-xs text-[var(--color-warning-strong)]">
          {tr("These were recorded earlier without an examination.")}{" "}{canAttach ? tr("Use Edit to add one to {attachTo}, or remove it.", { attachTo }) : tr("Add the examination they belong to, then use Edit to link each one, or remove it.")}
        </p>
      </div>
      <ul className="divide-y divide-[var(--color-line)] text-sm">
        {results.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span className="text-[var(--color-ink)]">
              {tr(r.subject)}
              <span className="text-[var(--color-ink-soft)]">
                {" "}
                · {exam.get(r.qualification)?.qualification ?? r.qualification} · {r.value || exam.resultType(r.resultTypeId)?.label || "—"}
              </span>
            </span>
            <span className="flex items-center gap-3 whitespace-nowrap">
              {canAttach && (
                <button onClick={() => onEdit(r)} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink)] hover:underline">
                  <Pencil className="h-3 w-3" strokeWidth={2} />
                  {tr("Edit")}
                </button>
              )}
              <button onClick={() => onDelete(r.id)} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger)] hover:underline">
                <Trash2 className="h-3 w-3" strokeWidth={2} />
                {tr("Remove")}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RowActions({ confirming, onEdit, onAskDelete, onCancelDelete, onDelete }: { confirming: boolean; onEdit: () => void; onAskDelete: () => void; onCancelDelete: () => void; onDelete: () => void }) {
  const tr = useT();
  if (confirming) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-xs text-[var(--color-ink-soft)]">{tr("Remove?")}</span>
        <button onClick={onDelete} className="text-xs font-medium text-[var(--color-danger)] underline underline-offset-4">
          {tr("Yes")}
        </button>
        <button onClick={onCancelDelete} className="text-xs font-medium text-[var(--color-ink-soft)] underline underline-offset-4">
          {tr("Cancel")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink)] hover:underline">
        <Pencil className="h-3 w-3" strokeWidth={2} />
        {tr("Edit")}
      </button>
      <button onClick={onAskDelete} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger)] hover:underline">
        <Trash2 className="h-3 w-3" strokeWidth={2} />
        {tr("Delete")}
      </button>
    </div>
  );
}

function Alert({ children, flush }: { children: React.ReactNode; flush?: boolean }) {
  return (
    <p
      role="alert"
      className={
        flush
          ? "border-b border-[var(--color-line)] bg-[var(--color-danger-soft)] px-5 py-2.5 text-sm text-[var(--color-danger-strong)]"
          : "mb-4 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-strong)]"
      }
    >
      {children}
    </p>
  );
}

function SavedResult({ entry, exam }: { entry: ResultView; exam: ExamConfiguration }) {
  const tr = useT();
  if (entry.resultTypeId) {
    return <ResultBadge tone="neutral" label={exam.resultType(entry.resultTypeId)?.label ?? tr("Not graded")} />;
  }
  const config = exam.get(entry.qualification);
  if (!config || !entry.value) return null;
  const result = computeResult(config, entry.value);
  return <ResultBadge tone={result === "Pass" ? "pass" : "fail"} label={exam.resultLabel(result)} />;
}

function ResultBadge({ tone, label }: { tone: "pass" | "fail" | "neutral"; label: string }) {
  const classes = {
    pass: "border-[var(--color-success-soft)] bg-[var(--color-success-soft)] text-[var(--color-success-strong)]",
    fail: "border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] text-[var(--color-danger-strong)]",
    neutral: "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)]",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>
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
