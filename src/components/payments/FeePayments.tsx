"use client";

import { useMemo } from "react";
import Link from "next/link";
import { feePaymentStore, institutionFeeView } from "@/lib/payments/applicationFees";
import { institutionTuitionView, tuitionStore } from "@/lib/tuition/data";

/**
 * The institution dashboard's one-line "awaiting payment" list. The
 * dashboard isn't connected to the database yet, so this still reads the
 * sample records in src/lib/payments/applicationFees.ts.
 *
 * The screens that work on real payment records are
 * ./PaymentVerificationDesk.tsx (Cheeta administration) and
 * ./InstitutionApplicationFees.tsx (the institution's Application fees page).
 */
export function AwaitingPaymentList({ institutionId, limit = 8 }: { institutionId: string; limit?: number }) {
  const fees = feePaymentStore.useItems();
  const accounts = tuitionStore.useItems();
  const items = useMemo(() => {
    const fromFees = fees
      .filter((f) => f.institutionId === institutionId)
      .map(institutionFeeView)
      .filter((v) => v.state === "AWAITING")
      .map((v) => ({ id: v.id, name: v.displayName, what: "Application fee" }));
    const fromTuition = accounts
      .filter((a) => a.institutionId === institutionId)
      .map(institutionTuitionView)
      .filter((v) => v.masked)
      .map((v) => ({ id: v.id, name: v.displayName, what: "Tuition" }));
    return [...fromFees, ...fromTuition].sort((a, b) => a.name.localeCompare(b.name));
  }, [fees, accounts, institutionId]);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]" aria-labelledby="awaiting-payment">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
        <h2 id="awaiting-payment" className="font-semibold text-base text-[var(--color-ink)]">
          Awaiting payment
        </h2>
        <p className="text-xs text-[var(--color-ink-faint)]">Details appear once AOSA approves</p>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--color-ink-soft)]">No one is awaiting payment approval.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {items.slice(0, limit).map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-[var(--color-ink)]">
                {i.name} <span className="text-[var(--color-ink-soft)]">— awaiting payment</span>
              </span>
              <span className="text-xs text-[var(--color-ink-faint)]">{i.what}</span>
            </li>
          ))}
        </ul>
      )}
      {items.length > limit && (
        <p className="border-t border-[var(--color-line)] px-5 py-2.5 text-sm">
          <Link href="/institution/payments" className="text-[var(--color-ink)] underline underline-offset-4">
            {items.length - limit} more
          </Link>
        </p>
      )}
    </section>
  );
}
