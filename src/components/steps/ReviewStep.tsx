"use client";

import { Application } from "@/lib/types";
import { PrimaryButton } from "@/components/Form";
import { institutions, programs, stepOrder } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export function ReviewStep({ application, onFinalSubmit }: { application: Application; onFinalSubmit: () => void }) {
  const allStepsSubmitted = stepOrder
    .filter((k) => k !== "review")
    .every((k) => application.steps[k] === "submitted");

  return (
    <div className="space-y-6">
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Applicant</p>
        <p className="text-sm text-[var(--color-ink)]">
          {application.personalInfo?.firstName} {application.personalInfo?.lastName}
        </p>
        <p className="text-sm text-[var(--color-ink-soft)]">{application.personalInfo?.email}</p>
      </div>

      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Institutions & program choices</p>
        <div className="space-y-3">
          {application.institutionIds.map((instId) => {
            const inst = institutions.find((i) => i.id === instId);
            const choices = application.programChoices
              .filter((c) => c.institutionId === instId)
              .sort((a, b) => a.rank - b.rank);
            return (
              <div key={instId}>
                <p className="text-sm font-medium text-[var(--color-ink)]">{inst?.name}</p>
                <ul className="mt-1 space-y-0.5 pl-4 text-sm text-[var(--color-ink-soft)]">
                  {choices.map((c) => {
                    const p = programs.find((pr) => pr.id === c.programId);
                    return (
                      <li key={c.programId}>
                        {c.rank}. {p?.name}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Documents</p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {application.documents.filter((d) => d.fileName).length} of {application.documents.length} required documents uploaded
        </p>
      </div>

      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Payment</p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {application.payment?.method} — reference {application.payment?.reference}
        </p>
        <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
          {formatCurrency(application.payment?.amount ?? 0)}
        </p>
      </div>

      <div className="border-t border-[var(--color-line)] pt-5">
        {!allStepsSubmitted && (
          <p className="mb-3 text-sm text-[var(--color-danger)]">
            Complete and submit every earlier step before you can submit your application.
          </p>
        )}
        <PrimaryButton type="button" disabled={!allStepsSubmitted} onClick={onFinalSubmit}>
          Submit application
        </PrimaryButton>
      </div>
    </div>
  );
}
