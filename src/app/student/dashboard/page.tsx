"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Topbar } from "@/components/Topbar";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessProgress } from "@/components/ProcessProgress";
import { FormError } from "@/components/Form";
import { formatMoney } from "@/lib/currency/money";
import { PROCESS_STEPS } from "@/lib/processFlow";
import { useMyOverview } from "@/lib/student/overview";
import { useT } from "@/lib/i18n/client";

export default function DashboardPage() {
  const tr = useT();
  const { user } = useAuth();
  const firstName = user?.fullName.split(" ")[0] ?? "there";

  const { data, error } = useMyOverview();
  if (!data) {
    return (
      <>
        <Topbar title={tr("Welcome back, {firstName}", { firstName })} description={tr("Here's where your application stands today.")} />
        <main className="px-4 py-6 sm:px-8 sm:py-8">{error ? <FormError>{error}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>}</main>
      </>
    );
  }
  const { progress, institutions, actions: actionsRequired } = data;

  const currentStep = PROCESS_STEPS.find((s) => s.order === progress.currentStepOrder) ?? PROCESS_STEPS[0];

  const stats = [
    { label: tr("Institutions selected"), value: String(institutions.length) },
    { label: tr("Total fees due"), value: formatMoney(data.fees.outstanding, data.fees.currency) },
    { label: tr("Current step"), value: tr("Step {order} of {total}", { order: currentStep.order, total: PROCESS_STEPS.length }) },
    { label: tr("Actions required"), value: String(actionsRequired.length) },
  ];

  return (
    <>
      <Topbar title={tr("Welcome back, {firstName}", { firstName })} description={tr("Here's where your application stands today.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {/* Applicant name, current step, progress at a glance */}
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--color-ink-faint)]">{tr("Current step")}</p>
              <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">
                {tr("Step {order}: {shortTitle}", { order: currentStep.order, shortTitle: tr(currentStep.shortTitle) })}
              </p>
            </div>
            <Link
              href="/student/process-flow"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)] underline underline-offset-4"
            >
              {tr("View the full process flow")}
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
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-[var(--color-surface)] px-5 py-4">
              <p className="font-bold tracking-tight text-2xl text-[var(--color-ink)] sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{tr(s.label)}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Application statuses */}
          <div className="min-w-0">
            <h2 className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr("Application statuses")}</h2>
            <div className="mt-3 divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
              {institutions.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-[var(--color-ink-soft)]">
                  {tr("You haven't added an institution yet.")}{" "}
                  <Link href="/student/institutions/add" className="text-[var(--color-ink)] underline underline-offset-4">
                    {tr("Add an institution")}
                  </Link>
                </p>
              )}
              {institutions.map((inst) => (
                <Link key={inst.id} href="/student/application/status" className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--color-paper)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">{inst.institution.name}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      {inst.applicationNumber ? tr("Application ID {applicationNumber}", { applicationNumber: inst.applicationNumber }) : tr("Reference {reference} · not submitted yet", { reference: inst.reference })}
                    </p>
                  </div>
                  <StatusBadge status={inst.status} />
                </Link>
              ))}
            </div>
          </div>

          {/* Actions required */}
          <div className="min-w-0">
            <h2 className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr("Actions required")}</h2>
            {actionsRequired.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[var(--color-line-strong)] px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">
                {tr("Nothing needs your attention right now.")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {actionsRequired.map((action, i) => (
                  <li key={i}>
                    <Link
                      href={action.href}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-warning)]"
                    >
                      <span>{tr(action.label, action.values)}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-warning)]" strokeWidth={2} />
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
