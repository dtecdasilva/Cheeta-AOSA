"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Topbar } from "@/components/Topbar";
import { PrimaryButton } from "@/components/Form";
import { institutions } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Check } from "lucide-react";

export default function NewApplicationPage() {
  const { createApplication } = useApp();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const totalFees = selected.reduce((sum, id) => {
    const inst = institutions.find((i) => i.id === id);
    return sum + (inst ? inst.applicationFee + inst.webFee : 0);
  }, 0);

  function handleStart() {
    const app = createApplication(selected);
    router.push(`/student/applications/${app.id}`);
  }

  return (
    <>
      <Topbar title="Start a new application" description="Select one or more institutions. You can apply to several at once." />
      <main className="px-8 py-8">
        <div className="grid gap-3 sm:grid-cols-2">
          {institutions.map((inst) => {
            const active = selected.includes(inst.id);
            return (
              <button
                key={inst.id}
                onClick={() => toggle(inst.id)}
                className={`flex items-start gap-4 border px-5 py-4 text-left transition-colors ${
                  active ? "border-[var(--color-brass)] bg-[var(--color-brass-soft)]/40" : "border-[var(--color-line)] bg-white hover:border-[var(--color-line-strong)]"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--color-line-strong)] bg-[var(--color-paper)] font-[var(--font-display)] text-lg text-[var(--color-ink)]">
                  {inst.logoInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--color-ink)]">{inst.name}</p>
                    {active && <Check className="h-4 w-4 shrink-0 text-[var(--color-brass-dark)]" strokeWidth={2.5} />}
                  </div>
                  <p className="text-xs text-[var(--color-ink-faint)]">
                    {inst.type} · {inst.location}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                    Application fee {formatCurrency(inst.applicationFee)} + web fee {formatCurrency(inst.webFee)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-[var(--color-line)] pt-6">
          <div>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {selected.length} institution{selected.length === 1 ? "" : "s"} selected
            </p>
            <p className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
              Estimated fees: {formatCurrency(totalFees)}
            </p>
          </div>
          <PrimaryButton onClick={handleStart} disabled={selected.length === 0}>
            Continue to application
          </PrimaryButton>
        </div>
      </main>
    </>
  );
}
