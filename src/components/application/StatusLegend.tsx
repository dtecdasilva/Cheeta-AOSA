"use client";

import { ADMIN_STATUS_LABELS } from "@/lib/admin/status";
import { STATUS_DESCRIPTIONS } from "@/lib/applications/statusFlow";
import type { ApplicationStatus } from "@/lib/types";
import { useT } from "@/lib/i18n/client";

const ORDER: ApplicationStatus[] = ["INCOMPLETE", "COMPLETED", "SUBMITTED", "I_ACKNOWLEDGED", "I_REJECTED", "RESUBMITTED", "ACCEPTED", "A_ACKNOWLEDGED", "A_REJECTED"];

/** "Description of Status": what each status an application can be in means. */
export function StatusLegend() {
  const tr = useT();
  return (
    <details className="mt-8 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-[var(--color-ink)]">{tr("Description of Status")}</summary>
      <dl className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)] text-sm">
        {ORDER.map((s) => (
          <div key={s} className="grid gap-1 px-5 py-2.5 sm:grid-cols-[12rem_1fr]">
            <dt className="font-medium text-[var(--color-ink)]">{tr(ADMIN_STATUS_LABELS[s])}</dt>
            <dd className="text-[var(--color-ink-soft)]">{tr(STATUS_DESCRIPTIONS[s])}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
