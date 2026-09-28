"use client";

import type { ApplicationStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/utils";

type Entry = { status: ApplicationStatus; actor: string; note?: string; at: string };

export type AdmissionOffer = {
  offeredAt: string;
  decisionBy?: string;
  details: string;
};

export default function ApplicationStatus({ history, rejectionReason, admission }: { history: Entry[]; rejectionReason?: string; admission?: AdmissionOffer }) {
  return (
    <div className="space-y-6">
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Application Status Timeline</p>
        <ol className="relative border-l border-[var(--color-line)]">
          {history.map((h, idx) => (
            <li key={idx} className="relative mb-6 ml-6 last:mb-0">
              <span className="absolute -left-[1.6875rem] top-1 flex h-3 w-3 items-center justify-center bg-[var(--color-surface)]">
                <span className="h-2 w-2 bg-[var(--color-ink-faint)]" />
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={h.status} />
                  <div>
                    <div className="text-sm font-medium text-[var(--color-ink)]">{h.note ?? h.status}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">{formatDateTime(h.at)}</div>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-ink-soft)]">{h.actor}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {rejectionReason && (
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <p className="mb-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">Rejection reason</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{rejectionReason}</p>
        </div>
      )}

      {history.some((h) => h.status === "RESUBMITTED") && (
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <p className="mb-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">Resubmission</p>
          <p className="text-sm text-[var(--color-ink-soft)]">You resubmitted your application. Institutions will re-review documents and fees.</p>
        </div>
      )}

      {admission && (
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <p className="mb-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">Admission information</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{admission.details}</p>
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">Offered at: {formatDateTime(admission.offeredAt)}</p>
          {admission.decisionBy && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Decision by: {admission.decisionBy}</p>}
        </div>
      )}
    </div>
  );
}
