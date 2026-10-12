"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { useExamConfiguration, groupByFamily } from "@/lib/examination/mockConfig";
import type { ExaminationView } from "@/lib/examination/records";

/** A sitting as the form holds it: the three things that identify it. */
interface Sitting {
  id: string;
  examinationYear: string;
  candidateNumber: string;
  centreNumber: string;
}

type ExaminationRecord = ExaminationView;

const RESULTS_HREF = "/student/application/results";

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function blankSitting(): Sitting {
  return { id: nextId("sitting"), examinationYear: "", candidateNumber: "", centreNumber: "" };
}

export function ExaminationForm() {
  // This form only creates the examination: its qualification, and the
  // year, candidate number and centre number of each sitting. No subjects
  // or grades are entered here. Those are the results, added afterwards on
  // the Results Information form to an examination created here.
  //
  // Records are the applicant's own, kept by the API (/api/student/examinations).
  // Qualifications and sitting limits come from the examination parameters
  // administrators manage, served by /api/config/examinations.
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
  /** The examination just created, so the way on to its results can be offered. */
  const [justAdded, setJustAdded] = useState<ExaminationRecord | null>(null);

  const config = qualification ? exam.get(qualification) : undefined;

  function clearProblems() {
    setFormError(null);
    setErrors({});
  }

  function openAddForm() {
    clearProblems();
    setJustAdded(null);
    setEditingId(null);
    setQualification("");
    setSittings([]);
    setFormOpen(true);
  }

  function openEditForm(record: ExaminationRecord) {
    clearProblems();
    setJustAdded(null);
    setEditingId(record.id);
    setQualification(record.qualification);
    setSittings(record.sittings.map((s) => ({ id: s.id, examinationYear: s.examinationYear, candidateNumber: s.candidateNumber, centreNumber: s.centreNumber })));
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
    // Each qualification has its own limit on sittings. What has been
    // typed is kept where it still fits; the count starts at the
    // qualification's usual number.
    const next = value ? exam.get(value) : undefined;
    if (!next) {
      setSittings([]);
      return;
    }
    setSittings((prev) => {
      const count = Math.min(Math.max(prev.length, next.defaultSittings), next.maxSittings);
      return Array.from({ length: count }, (_, i) => prev[i] ?? blankSitting());
    });
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

  const canSave =
    !!qualification &&
    sittings.length > 0 &&
    sittings.every((s) => s.examinationYear.trim() && s.candidateNumber.trim() && s.centreNumber.trim());

  async function saveRecord() {
    if (!canSave || saving) return;
    clearProblems();
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/student/examinations/${editingId}` : "/api/student/examinations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualification,
          sittings: sittings.map((st) => ({ examinationYear: st.examinationYear, candidateNumber: st.candidateNumber, centreNumber: st.centreNumber })),
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
      const created = !editingId;
      closeForm();
      setJustAdded(created ? saved : null);
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
        if (justAdded?.id === id) setJustAdded(null);
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
                  <th className="px-5 py-2.5 font-normal">Results</th>
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
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                      <Link href={`${RESULTS_HREF}?examination=${encodeURIComponent(r.sittings[0]?.id ?? "")}`} className="whitespace-nowrap text-xs font-medium text-[var(--color-ink)] underline underline-offset-4">
                        {resultCount(r) === 0 ? "Add results" : `${resultCount(r)} recorded`}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      {confirmDeleteId === r.id ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-xs text-[var(--color-ink-soft)]">{resultCount(r) > 0 ? `Remove, with its ${resultCount(r)} result${resultCount(r) === 1 ? "" : "s"}?` : "Remove?"}</span>
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

      {justAdded && !formOpen && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-5 py-3.5">
          <p className="text-sm text-[var(--color-success-strong)]">
            {exam.get(justAdded.qualification)?.qualification ?? "Examination"} added. Next, record the results you obtained in it.
          </p>
          <Link href={`${RESULTS_HREF}?examination=${encodeURIComponent(justAdded.sittings[0]?.id ?? "")}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-success-strong)] underline underline-offset-4">
            Add its results
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
      )}

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
            <Field label="Qualification" required error={errors.qualification}>
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
              <Field label="Number of sittings" required hint={`Up to ${config.maxSittings} for this qualification.`} error={errors.sittings}>
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

          {/* One block per sitting: when it was sat, and the candidate and
              centre numbers on that sitting's slip. */}
          {config &&
            sittings.map((sitting, i) => (
              <div key={sitting.id} className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
                <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">
                  Sitting {i + 1}
                  {sittings.length > 1 ? ` of ${sittings.length}` : ""}
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Examination year" required error={errors[`sittings.${i}.examinationYear`]}>
                    <TextInput
                      inputMode="numeric"
                      placeholder="e.g. 2023"
                      value={sitting.examinationYear}
                      onChange={(e) => updateSitting(sitting.id, "examinationYear", e.target.value)}
                    />
                  </Field>
                  <Field label="Candidate number" required error={errors[`sittings.${i}.candidateNumber`]}>
                    <TextInput
                      value={sitting.candidateNumber}
                      onChange={(e) => updateSitting(sitting.id, "candidateNumber", e.target.value)}
                    />
                  </Field>
                  <Field label="Centre number" required error={errors[`sittings.${i}.centreNumber`]}>
                    <TextInput
                      value={sitting.centreNumber}
                      onChange={(e) => updateSitting(sitting.id, "centreNumber", e.target.value)}
                    />
                  </Field>
                </div>

              </div>
            ))}

          <p className="mt-5 text-xs text-[var(--color-ink-faint)]">
            Subjects and grades aren&apos;t entered here. Once the examination is saved, add them under Results Information.
          </p>

          <div className="mt-4 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
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

/** How many results have been recorded against an examination, across its sittings. */
function resultCount(record: ExaminationRecord): number {
  return record.sittings.reduce((n, s) => n + s.resultCount, 0);
}
