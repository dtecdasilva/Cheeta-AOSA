"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Topbar } from "@/components/Topbar";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessProgress } from "@/components/ProcessProgress";
import { institutions } from "@/lib/data";
import { getMockDashboardData } from "@/lib/mockDashboard";
import { PROCESS_STEPS } from "@/lib/processFlow";

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName.split(" ")[0] ?? "there";

  const { selectedInstitutionIds, perInstitutionStatus, totalFeesFormatted, progress, actionsRequired } =
    getMockDashboardData();

  const currentStep = PROCESS_STEPS.find((s) => s.order === progress.currentStepOrder) ?? PROCESS_STEPS[0];

  const stats = [
    { label: "Institutions selected", value: String(selectedInstitutionIds.length) },
    { label: "Total fees due", value: totalFeesFormatted },
    { label: "Current step", value: `Step ${currentStep.order} of ${PROCESS_STEPS.length}` },
    { label: "Actions required", value: String(actionsRequired.length) },
  ];

  return (
    <>
      <Topbar title={`Welcome back, ${firstName}`} description="Here's where your application stands today." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {/* Applicant name, current step, progress at a glance */}
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--color-ink-faint)]">Current step</p>
              <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
                Step {currentStep.order}: {currentStep.shortTitle}
              </p>
            </div>
            <Link
              href="/student/process-flow"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)] underline underline-offset-4"
            >
              View the full process flow
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="mt-6 overflow-x-auto pb-1">
            <div className="min-w-[560px]">
              <ProcessProgress progress={progress} variant="compact" />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-px border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-[var(--color-surface)] px-5 py-4">
              <p className="font-[var(--font-display)] text-2xl text-[var(--color-ink)] sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Application statuses */}
          <div>
            <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">Application statuses</h2>
            <div className="mt-3 divide-y divide-[var(--color-line)] border border-[var(--color-line)] bg-[var(--color-surface)]">
              {selectedInstitutionIds.map((id) => {
                const inst = institutions.find((i) => i.id === id);
                if (!inst) return null;
                return (
                  <div key={id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-ink)]">{inst.name}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">
                        {inst.type} · {inst.location}
                      </p>
                    </div>
                    <StatusBadge status={perInstitutionStatus[id]} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions required */}
          <div>
            <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">Actions required</h2>
            {actionsRequired.length === 0 ? (
              <p className="mt-3 border border-dashed border-[var(--color-line-strong)] px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">
                Nothing needs your attention right now.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {actionsRequired.map((action) => (
                  <li key={action.label}>
                    <Link
                      href={action.href}
                      className="flex items-center justify-between gap-3 border border-[var(--color-amber-soft)] bg-[var(--color-amber-soft)] px-4 py-3 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-amber)]"
                    >
                      <span>{action.label}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-amber)]" strokeWidth={2} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
