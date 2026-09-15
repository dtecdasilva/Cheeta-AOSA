"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ExaminationRecord } from "@/lib/types";
import { Field, TextInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { uid } from "@/lib/utils";

function blank(): ExaminationRecord {
  return { id: uid("exam"), examName: "", examYear: "", centerNumber: "", resultsSummary: "" };
}

export function ExaminationStep({
  records,
  editable,
  onSave,
  onSubmit,
}: {
  records: ExaminationRecord[];
  editable: boolean;
  onSave: (records: ExaminationRecord[]) => void;
  onSubmit: () => void;
}) {
  const [rows, setRows] = useState<ExaminationRecord[]>(records.length ? records : [blank()]);
  const [saved, setSaved] = useState(false);

  function update(id: string, patch: Partial<ExaminationRecord>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  const isComplete = rows.length > 0 && rows.every((r) => r.examName && r.examYear && r.resultsSummary);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={row.id} className="border border-[var(--color-line)] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--color-ink)]">Examination {i + 1}</p>
              {editable && rows.length > 1 && (
                <button
                  onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                  className="text-[var(--color-danger)]"
                  aria-label="Remove examination"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Examination name" required>
                <TextInput value={row.examName} onChange={(e) => update(row.id, { examName: e.target.value })} placeholder="e.g. GCE Advanced Level" disabled={!editable} />
              </Field>
              <Field label="Year sat" required>
                <TextInput value={row.examYear} onChange={(e) => update(row.id, { examYear: e.target.value })} placeholder="2024" disabled={!editable} />
              </Field>
              <Field label="Examination centre number">
                <TextInput value={row.centerNumber} onChange={(e) => update(row.id, { centerNumber: e.target.value })} disabled={!editable} />
              </Field>
              <Field label="Results summary" required>
                <TextInput value={row.resultsSummary} onChange={(e) => update(row.id, { resultsSummary: e.target.value })} placeholder="e.g. 3 papers, grades A A B" disabled={!editable} />
              </Field>
            </div>
          </div>
        ))}
      </div>

      {editable && (
        <button
          onClick={() => setRows((rs) => [...rs, blank()])}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)] underline underline-offset-4"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add another examination
        </button>
      )}

      {editable && (
        <div className="flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
          <SecondaryButton
            type="button"
            onClick={() => {
              onSave(rows);
              setSaved(true);
            }}
          >
            Save progress
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={!isComplete}
            onClick={() => {
              onSave(rows);
              onSubmit();
            }}
          >
            Submit and continue
          </PrimaryButton>
          {saved && <span className="text-xs text-[var(--color-success)]">Saved</span>}
        </div>
      )}
    </div>
  );
}
