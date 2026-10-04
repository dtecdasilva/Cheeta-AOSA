"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DemographicCompletion, DemographicCompletionStatus } from "@/lib/demographic/completion";

const STATUS: Record<DemographicCompletionStatus, { label: string; pill: string; dot: string }> = {
  NOT_STARTED: { label: "Not started", pill: "bg-[var(--color-line)]/60 text-[var(--color-ink-soft)]", dot: "bg-[var(--color-ink-faint)]" },
  IN_PROGRESS: { label: "In progress", pill: "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]", dot: "bg-[var(--color-warning)]" },
  COMPLETE: { label: "Complete", pill: "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]", dot: "bg-[var(--color-success)]" },
};

export function DemographicStatusPill({ status }: { status: DemographicCompletionStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.pill}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** One line saying what the status means for the applicant right now. */
function summary(c: DemographicCompletion): string {
  if (c.status === "COMPLETE") return `Submitted${c.submittedAt ? ` on ${new Date(c.submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}. You can still correct details here.`;
  if (c.status === "NOT_STARTED") return "Nothing saved yet. You can save as you go and finish later.";
  if (c.readyToSubmit) return "Everything required is filled in. Choose Save & Continue to complete this section.";
  return "Saved as a draft. Fill in the remaining required fields, then choose Save & Continue.";
}

/**
 * Completion status of the demographic section as last saved: the status,
 * how many required fields are done, and which are still missing.
 */
export function DemographicCompletionPanel({ completion }: { completion: DemographicCompletion }) {
  const { requiredCompleted, requiredTotal, percent, missingFields, invalidFields } = completion;
  return (
    <section aria-label="Completion status" className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Completion status</h2>
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{summary(completion)}</p>
        </div>
        <DemographicStatusPill status={completion.status} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={requiredTotal}
          aria-valuenow={requiredCompleted}
          aria-label="Required fields completed"
        >
          <div className={`h-full rounded-full ${completion.status === "COMPLETE" ? "bg-[var(--color-success)]" : "bg-[var(--color-brand)]"}`} style={{ width: `${percent}%` }} />
        </div>
        <p className="shrink-0 text-sm tabular-nums text-[var(--color-ink-soft)]">
          <span className="font-semibold text-[var(--color-ink)]">{requiredCompleted}</span> of {requiredTotal} required fields
        </p>
      </div>

      {missingFields.length > 0 && completion.status !== "NOT_STARTED" && (
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          <span className="font-medium text-[var(--color-ink)]">Still needed:</span> {missingFields.map((f) => f.label).join(", ")}
        </p>
      )}
      {invalidFields.length > 0 && (
        <p className="mt-2 text-sm text-[var(--color-danger-strong)]">
          <span className="font-medium">Needs correcting:</span> {invalidFields.map((f) => f.label).join(", ")}
        </p>
      )}
    </section>
  );
}

/**
 * The Demographic card on the Application Summary: the applicant's name
 * and the section's completion status, read from the API.
 */
export function DemographicSummaryCard() {
  const [state, setState] = useState<{ name: string; completion: DemographicCompletion } | "loading" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/demographic", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        setState(res.ok ? { name: data.profile?.fullNameOnBirthCertificate ?? "", completion: data.completion } : "failed");
      })
      .catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = typeof state === "object" ? state : null;
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-[var(--color-ink)]">Demographic</p>
            {loaded && <DemographicStatusPill status={loaded.completion.status} />}
          </div>
          {state === "loading" && <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>}
          {state === "failed" && <p className="text-sm text-[var(--color-ink-soft)]">Could not load your demographic information.</p>}
          {loaded && (
            <>
              <p className="text-sm text-[var(--color-ink-soft)]">{loaded.name || "Not provided"}</p>
              {loaded.completion.status !== "COMPLETE" && (
                <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                  {loaded.completion.requiredCompleted} of {loaded.completion.requiredTotal} required fields
                  {loaded.completion.readyToSubmit ? " — ready to submit" : ""}
                </p>
              )}
            </>
          )}
        </div>
        <Link href="/student/application/demographic" className="shrink-0 text-sm text-[var(--color-ink)] underline">
          {loaded && loaded.completion.status === "NOT_STARTED" ? "Start" : "Edit"}
        </Link>
      </div>
    </div>
  );
}
