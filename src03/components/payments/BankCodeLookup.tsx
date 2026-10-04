"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TextInput } from "@/components/Form";
import { ToneBadge } from "@/components/admin/ui";
import { feePaymentStore } from "@/lib/payments/applicationFees";
import { findByBankCode, tuitionStore } from "@/lib/tuition/data";
import { BANK_CODE_HINT, normalizeBankCode } from "@/lib/payments/privacy";
import { formatCurrency, formatDate } from "@/lib/utils";
import { buttonClass } from "@/lib/ui/button";

/**
 * Identify a paid student by the bank code AOSA issued on approval.
 * Only approved payments at this institution can be found; a code for an
 * unapproved, rejected or other institution's payment finds nothing, and
 * the message doesn't say which, so the lookup can't be used to probe.
 */
export function BankCodeLookup({ institutionId, tuitionHref }: { institutionId: string; tuitionHref: string }) {
  const fees = feePaymentStore.useItems();
  const accounts = tuitionStore.useItems();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const code = normalizeBankCode(query);
  const fee = code ? fees.find((f) => f.approval === "APPROVED" && f.bankCode === code && f.institutionId === institutionId) : undefined;
  const tuition = code && !fee ? findByBankCode(accounts.filter((a) => a.institutionId === institutionId), code) : null;

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 sm:p-5" aria-labelledby="bank-code-lookup">
      <h2 id="bank-code-lookup" className="font-semibold text-base text-[var(--color-ink)]">
        Find a paid student by bank code
      </h2>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input);
        }}
      >
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{BANK_CODE_HINT}</span>
          <TextInput value={input} onChange={(e) => setInput(e.target.value)} placeholder="BK26-A7KQ-M9TX" className="font-mono uppercase" autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" className={buttonClass("primary")}>
          <Search className="h-4 w-4" strokeWidth={1.75} />
          Find student
        </button>
      </form>

      {query && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4" role="status" aria-live="polite">
          {fee ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  {fee.firstName} {fee.lastName}
                </p>
                <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                  Application fee for {fee.programName}, application {fee.applicationRef}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Approved by AOSA {formatDate(fee.reviewedAt)}</p>
              </div>
              <div className="text-right">
                <ToneBadge tone="success">Paid</ToneBadge>
                <p className="mt-1 text-sm tabular-nums text-[var(--color-ink)]">{formatCurrency(fee.applicationFee)}</p>
              </div>
            </div>
          ) : tuition ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`${tuitionHref}/${tuition.account.id}`} className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
                  {tuition.account.studentName}
                </Link>
                <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                  Tuition for {tuition.account.programName}, {tuition.account.registrationNo}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                  {tuition.payment.receivedAt ? `Marked received ${formatDate(tuition.payment.receivedAt)}` : "Not yet marked received"}
                </p>
              </div>
              <div className="text-right">
                <ToneBadge tone="success">Paid</ToneBadge>
                <p className="mt-1 text-sm tabular-nums text-[var(--color-ink)]">{formatCurrency(tuition.payment.amount)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-soft)]">
              No approved payment at your institution has the bank code <span className="font-mono text-[var(--color-ink)]">{code}</span>. Check the code against the approval notice. Payments AOSA hasn&apos;t approved yet don&apos;t have a code.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
