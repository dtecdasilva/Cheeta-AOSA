"use client";

import { ApplicationStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

type Entry = { status: ApplicationStatus; actor: string; note?: string; at: string };

export default function ApplicationStatus({ history, rejectionReason, admission }: { history: Entry[]; rejectionReason?: string; admission?: any }) {
  return (
    <div className="space-y-6">
      <div className="border border-[var(--color-line)] bg-white p-5">
        <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Application Status Timeline</p>
        <ol className="relative border-l border-[var(--color-line)]">
          {history.map((h, idx) => (
            <li key={idx} className="mb-6 ml-6">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-ink-faint)]" />
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={h.status} />
                  <div>
                    <div className="text-sm font-medium text-[var(--color-ink)]">{h.note ?? h.status}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">{new Date(h.at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-ink-soft)]">{h.actor}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {rejectionReason && (
        <div className="border border-[var(--color-line)] bg-white p-5">
          <p className="mb-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">Rejection reason</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{rejectionReason}</p>
        </div>
      )}

      {history.some((h) => h.status === "RESUBMITTED") && (
        <div className="border border-[var(--color-line)] bg-white p-5">
          <p className="mb-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">Resubmission</p>
          <p className="text-sm text-[var(--color-ink-soft)]">You resubmitted your application. Institutions will re-review documents and fees.</p>
        </div>
      )}

      {admission && (
        <div className="border border-[var(--color-line)] bg-white p-5">
          <p className="mb-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">Admission information</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{admission.details}</p>
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">Offered at: {new Date(admission.offeredAt).toLocaleString()}</p>
          {admission.decisionBy && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Decision by: {admission.decisionBy}</p>}
        </div>
      )}
    </div>
  );
}
