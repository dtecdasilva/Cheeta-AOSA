"use client";

import { Lock } from "lucide-react";
import { ToneBadge } from "@/components/admin/ui";
import { feeFor, feePaymentStore, institutionFeeView } from "@/lib/payments/applicationFees";
import { useHydrated } from "@/lib/admin/store";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Wraps an institution's application detail. While the student's fee is
 * awaiting AOSA approval the institution sees one line — "<name> —
 * awaiting payment" — instead of the application. Applications with no
 * payment recorded at all aren't affected: nothing has been paid, so
 * there's no payment to protect.
 */
export function ApplicationPaymentGate({ applicationId, institutionId, children }: { applicationId: string; institutionId: string; children: React.ReactNode }) {
  const hydrated = useHydrated();
  const fees = feePaymentStore.useItems();
  const fee = feeFor(fees, applicationId, institutionId);

  // Stored approvals live in this browser; don't flash the details before we know.
  if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  if (fee) {
    const v = institutionFeeView(fee);
    if (v.state === "AWAITING") {
      return (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-10 text-center">
          <Lock className="mx-auto h-6 w-6 text-[var(--color-ink-faint)]" strokeWidth={1.5} aria-hidden />
          <p className="mt-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">
            {v.displayName} — awaiting payment
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-ink-soft)]">
            AOSA is checking this applicant&apos;s payment. The application opens here once it&apos;s approved, and you&apos;ll be able to find the student by the bank code AOSA issues.
          </p>
        </div>
      );
    }
  }
  return <>{children}</>;
}

/** The fee as the institution may see it: paid under a bank code, own fee only. */
export function InstitutionFeeStatus({ applicationId, institutionId }: { applicationId: string; institutionId: string }) {
  const fees = feePaymentStore.useItems();
  const fee = feeFor(fees, applicationId, institutionId);
  if (!fee) return <p className="text-sm text-[var(--color-ink-soft)]">No payment recorded yet.</p>;
  const v = institutionFeeView(fee);
  if (v.state === "AWAITING") {
    return (
      <p className="text-sm text-[var(--color-ink)]">
        {v.displayName} <span className="text-[var(--color-ink-soft)]">— awaiting payment</span>
      </p>
    );
  }
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-xs text-[var(--color-ink-soft)]">Status</dt>
        <dd className="mt-1">
          <ToneBadge tone="success">Paid</ToneBadge>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--color-ink-soft)]">Bank code</dt>
        <dd className="mt-1 font-mono text-[var(--color-ink)]">{v.bankCode}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--color-ink-soft)]">Application fee</dt>
        <dd className="mt-1 tabular-nums text-[var(--color-ink)]">
          {formatCurrency(v.applicationFee)} <span className="text-xs text-[var(--color-ink-faint)]">approved {formatDate(v.approvedAt)}</span>
        </dd>
      </div>
    </dl>
  );
}
