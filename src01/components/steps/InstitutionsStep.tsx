"use client";

import { useState } from "react";
import { ProgramChoice } from "@/lib/types";
import { PrimaryButton, SecondaryButton } from "@/components/Form";
import { institutions, programs } from "@/lib/data";

export function InstitutionsStep({
  institutionIds,
  choices,
  editable,
  onSave,
  onSubmit,
}: {
  institutionIds: string[];
  choices: ProgramChoice[];
  editable: boolean;
  onSave: (choices: ProgramChoice[]) => void;
  onSubmit: () => void;
}) {
  const [selected, setSelected] = useState<ProgramChoice[]>(choices);
  const [saved, setSaved] = useState(false);

  function toggle(institutionId: string, programId: string, maxChoices: number) {
    setSaved(false);
    setSelected((prev) => {
      const forInst = prev.filter((c) => c.institutionId === institutionId);
      const exists = forInst.find((c) => c.programId === programId);
      if (exists) {
        return prev
          .filter((c) => !(c.institutionId === institutionId && c.programId === programId))
          .map((c) => c); // ranks recalculated below
      }
      if (forInst.length >= maxChoices) return prev;
      const nextRank = (forInst.length + 1) as 1 | 2 | 3;
      return [...prev, { institutionId, programId, rank: nextRank }];
    });
  }

  const isComplete = institutionIds.every((id) => selected.some((c) => c.institutionId === id));

  return (
    <div className="space-y-6">
      {institutionIds.map((instId) => {
        const inst = institutions.find((i) => i.id === instId);
        if (!inst) return null;
        const options = programs.filter((p) => p.institutionId === instId);
        const chosen = selected.filter((c) => c.institutionId === instId).sort((a, b) => a.rank - b.rank);

        return (
          <div key={instId} className="border border-[var(--color-line)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-line)] px-5 py-3.5">
              <p className="font-medium text-[var(--color-ink)]">{inst.name}</p>
              <p className="text-xs text-[var(--color-ink-faint)]">
                Choose up to {inst.maxProgramChoices} program{inst.maxProgramChoices > 1 ? "s" : ""}, in order of preference.
              </p>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {options.map((p) => {
                const rank = chosen.find((c) => c.programId === p.id)?.rank;
                const disabled = !editable || (!rank && chosen.length >= inst.maxProgramChoices);
                return (
                  <button
                    key={p.id}
                    disabled={disabled}
                    onClick={() => toggle(instId, p.id, inst.maxProgramChoices)}
                    className={`flex w-full items-center justify-between gap-4 px-5 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      rank ? "bg-[var(--color-brass-soft)]/40" : "hover:bg-[var(--color-paper)]"
                    }`}
                  >
                    <div>
                      <p className="text-[var(--color-ink)]">{p.name}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">
                        {p.faculty} · {p.department} · {p.qualification}
                      </p>
                    </div>
                    {rank && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--color-brass)] bg-[var(--color-brass)] text-xs font-semibold text-white">
                        {rank}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {editable && (
        <div className="flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
          <SecondaryButton
            type="button"
            onClick={() => {
              onSave(selected);
              setSaved(true);
            }}
          >
            Save progress
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={!isComplete}
            onClick={() => {
              onSave(selected);
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
