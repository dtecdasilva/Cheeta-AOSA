"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EducationRecord } from "@/lib/types";
import { Field, TextInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { uid } from "@/lib/utils";

function blank(): EducationRecord {
  return { id: uid("edu"), institutionName: "", qualification: "", fieldOfStudy: "", startYear: "", endYear: "", gradeOrGpa: "" };
}

export function EducationStep({
  records,
  editable,
  onSave,
  onSubmit,
}: {
  records: EducationRecord[];
  editable: boolean;
  onSave: (records: EducationRecord[]) => void;
  onSubmit: () => void;
}) {
  const [rows, setRows] = useState<EducationRecord[]>(records.length ? records : [blank()]);
  const [saved, setSaved] = useState(false);

  function update(id: string, patch: Partial<EducationRecord>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  const isComplete = rows.length > 0 && rows.every((r) => r.institutionName && r.qualification && r.startYear && r.endYear);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={row.id} className="border border-[var(--color-line)] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--color-ink)]">Record {i + 1}</p>
              {editable && rows.length > 1 && (
                <button
                  onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                  className="text-[var(--color-danger)]"
                  aria-label="Remove record"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institution name" required>
                <TextInput value={row.institutionName} onChange={(e) => update(row.id, { institutionName: e.target.value })} disabled={!editable} />
              </Field>
              <Field label="Qualification obtained" required>
                <TextInput value={row.qualification} onChange={(e) => update(row.id, { qualification: e.target.value })} placeholder="e.g. Baccalaureate" disabled={!editable} />
              </Field>
              <Field label="Field of study">
                <TextInput value={row.fieldOfStudy} onChange={(e) => update(row.id, { fieldOfStudy: e.target.value })} disabled={!editable} />
              </Field>
              <Field label="Grade / GPA">
                <TextInput value={row.gradeOrGpa} onChange={(e) => update(row.id, { gradeOrGpa: e.target.value })} disabled={!editable} />
              </Field>
              <Field label="Start year" required>
                <TextInput value={row.startYear} onChange={(e) => update(row.id, { startYear: e.target.value })} placeholder="2019" disabled={!editable} />
              </Field>
              <Field label="End year" required>
                <TextInput value={row.endYear} onChange={(e) => update(row.id, { endYear: e.target.value })} placeholder="2023" disabled={!editable} />
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
          Add another education record
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
