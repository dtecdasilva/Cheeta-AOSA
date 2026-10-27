"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { DemographicSummaryCard } from "@/components/demographic/DemographicCompletion";
import { FormError } from "@/components/Form";
import { formatMoney } from "@/lib/currency/money";
import { useMyOverview } from "@/lib/student/overview";
import { useT } from "@/lib/i18n/client";

const DOC_STATE: Record<string, string> = { NOT_UPLOADED: "Not uploaded", PENDING: "Pending review", APPROVED: "Approved", REJECTED: "Rejected" };
const FEE_STATE: Record<string, string> = { UNPAID: "Not paid", REJECTED: "Payment rejected", AWAITING: "Awaiting approval", PAID: "Paid", UNPRICED: "Amount not available yet" };

/** Every section of the applicant's application and where it stands, from GET /api/student/overview. */
export default function ApplicationSummary() {
  const tr = useT();
  const { data, error } = useMyOverview();
  if (error) return <FormError>{error}</FormError>;
  if (!data) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  const { personal, institutions } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <DemographicSummaryCard />

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 font-semibold text-base text-[var(--color-ink)]">{tr("Education")}</p>
                <p className="text-sm text-[var(--color-ink-soft)]">{tr("{count} records", { count: personal.education })}</p>
              </div>
              <Link href="/student/application/education" className="text-sm text-[var(--color-ink)] underline">{tr("Edit")}</Link>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 font-semibold text-base text-[var(--color-ink)]">{tr("Examinations & Results")}</p>
                <p className="text-sm text-[var(--color-ink-soft)]">{tr("{count} examinations, {results} results", { count: personal.examinations, results: personal.results })}</p>
              </div>
              <div className="flex gap-3">
                <Link href="/student/application/examinations" className="text-sm text-[var(--color-ink)] underline">{tr("Examinations")}</Link>
                <Link href="/student/application/results" className="text-sm text-[var(--color-ink)] underline">{tr("Results")}</Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <p className="mb-3 font-semibold text-base text-[var(--color-ink)]">{tr("Institutions & Program Choices")}</p>
            {institutions.length === 0 && (
              <p className="text-sm text-[var(--color-ink-soft)]">
                {tr("You haven't added an institution yet.")}{" "}
                <Link href="/student/institutions/add" className="text-[var(--color-ink)] underline">{tr("Add an institution")}</Link>
              </p>
            )}
            <div className="space-y-4">
              {institutions.map((inst) => (
                <div key={inst.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-ink)]">{inst.institution.name}</p>
                    <p className="text-sm text-[var(--color-ink-soft)]">
                      {inst.choices.length ? inst.choices.map((c) => `${c.rank}. ${c.program}`).join(" · ") : tr("No programs chosen")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={inst.status} />
                    <Link href="/student/institutions/summary" className="text-sm text-[var(--color-ink)] underline">{tr("Edit")}</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <p className="mb-3 font-semibold text-base text-[var(--color-ink)]">{tr("Uploads")}</p>
            <div className="space-y-3">
              {institutions.map((inst) => (
                <div key={inst.id} className="border-t border-[var(--color-line)] pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--color-ink)]">{inst.institution.name}</p>
                    <p className="text-sm text-[var(--color-ink-soft)]">{tr("{uploaded} of {count} uploaded", { uploaded: inst.documents.uploadedRequired, count: inst.documents.required })}</p>
                  </div>
                  <ul className="mt-2 space-y-1 pl-4 text-sm text-[var(--color-ink-soft)]">
                    {inst.documents.items.map((d) => (
                      <li key={d.name} className="flex items-center justify-between gap-3">
                        <span>
                          {tr(d.name)}
                          {!d.required && <span className="text-xs"> ({tr("Optional")})</span>}
                        </span>
                        <span className={`text-xs ${d.status === "REJECTED" ? "text-[var(--color-danger)]" : ""}`}>{tr(DOC_STATE[d.status] ?? d.status)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="mt-3">
                <Link href="/student/institutions/upload" className="text-sm text-[var(--color-ink)] underline">{tr("Manage uploads")}</Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <p className="mb-3 font-semibold text-base text-[var(--color-ink)]">{tr("Fees & Payments")}</p>
            <div className="space-y-2 text-sm text-[var(--color-ink-soft)]">
              {institutions.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-ink)]">{inst.institution.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{tr("Application fee + web fee")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--color-ink)]">{inst.fee?.total != null ? formatMoney(inst.fee.total, inst.fee.currency) : "—"}</p>
                    <p className="text-xs">
                      {tr(FEE_STATE[inst.fee?.state ?? "UNPRICED"])}
                      {inst.fee?.bankCode ? ` · ${tr("Bank code {bankCode}", { bankCode: inst.fee.bankCode })}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link href="/student/fees/summary" className="text-sm text-[var(--color-ink)] underline">{tr("View fees")}</Link>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="sticky top-20 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 lg:w-64">
            <p className="mb-3 font-semibold text-sm text-[var(--color-ink)]">{tr("Quick review")}</p>
            {institutions.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">{tr("Nothing to submit yet.")}</p>}
            <ul className="space-y-3 text-sm">
              {institutions.map((inst) => {
                const missing = inst.readiness.checks.filter((c) => !c.ok);
                return (
                  <li key={inst.id}>
                    <p className="font-medium text-[var(--color-ink)]">{inst.institution.name}</p>
                    {inst.submission.mode ? (
                      missing.length ? (
                        <p className="text-xs text-[var(--color-ink-soft)]">{tr("Still to do: {items}", { items: missing.map((c) => tr(c.label)).join(", ") })}</p>
                      ) : (
                        <p className="text-xs text-[var(--color-success-strong)]">{tr("Ready to submit")}</p>
                      )
                    ) : (
                      <p className="text-xs text-[var(--color-ink-soft)]">{tr(inst.submission.reason ?? "")}</p>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link href="/student/submit/print-submit" className="mt-4 inline-block text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
              {tr("Print and submit")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
