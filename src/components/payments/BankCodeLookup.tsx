"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TextInput } from "@/components/Form";
import { ToneBadge } from "@/components/admin/ui";
import { findByBankCode, type InstitutionFee } from "@/lib/payments/records";
import { useInstitutionTuition } from "@/lib/tuition/api";
import { BANK_CODE_HINT, normalizeBankCode } from "@/lib/payments/privacy";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/currency/money";
import { buttonClass } from "@/lib/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Identify a paid student by the bank code AOSA issued on approval.
 * Only approved payments at this institution can be found; a code for an
 * unapproved, rejected or other institution's payment finds nothing, and
 * the message doesn't say which, so the lookup can't be used to probe.
 */
export function BankCodeLookup({ institutionId, tuitionHref }: { institutionId: string; tuitionHref: string }) {
  const tr = useT();
  // The institution's own tuition view: only payments Cheeta has verified carry a bank code there.
  const { items: views } = useInstitutionTuition();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const code = normalizeBankCode(query);
  // Application fees are looked up on the server (/api/institution/fee-payments/lookup): only this institution's approved payments can be found.
  const [fee, setFee] = useState<Extract<InstitutionFee, { state: "PAID" }> | null>(null);
  const [looking, setLooking] = useState(false);
  useEffect(() => {
    setFee(null);
    if (!code) return;
    setLooking(true);
    findByBankCode(code).then((r) => {
      setFee(r.ok ? r.fee : null);
      setLooking(false);
    });
  }, [code]);
  void institutionId;
  const tuition = (() => {
    if (!code || fee) return null;
    for (const v of views) {
      const payment = v.confirmedPayments.find((x) => x.bankCode === code);
      if (payment) return { account: { id: v.id, studentName: v.displayName, programName: v.programName, registrationNo: v.registrationNo }, payment };
    }
    return null;
  })();

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 sm:p-5" aria-labelledby="bank-code-lookup">
      <h2 id="bank-code-lookup" className="font-semibold text-base text-[var(--color-ink)]">
        {tr("Find a paid student by bank code")}
      </h2>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input);
        }}
      >
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{tr(BANK_CODE_HINT)}</span>
          <TextInput value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr("BK26-A7KQ-M9TX")} className="font-mono uppercase" autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" className={buttonClass("primary")}>
          <Search className="h-4 w-4" strokeWidth={1.75} />
          {tr("Find student")}
        </button>
      </form>

      {query && looking && <p className="mt-4 text-sm text-[var(--color-ink-soft)]">{tr("Looking…")}</p>}
      {query && !looking && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4" role="status" aria-live="polite">
          {fee ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">{fee.displayName}</p>
                <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                  {tr("Application fee for {programName}, application {applicationRef}", { programName: fee.programName ?? "—", applicationRef: fee.applicationReference })}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr("Approved by AOSA {value}", { value: formatDate(fee.approvedAt) })}</p>
              </div>
              <div className="text-right">
                <ToneBadge tone="success">{tr("Paid")}</ToneBadge>
                <p className="mt-1 text-sm tabular-nums text-[var(--color-ink)]">{formatMoney(fee.applicationFee, fee.currency)}</p>
              </div>
            </div>
          ) : tuition ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`${tuitionHref}/${tuition.account.id}`} className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
                  {tr(tuition.account.studentName)}
                </Link>
                <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                  {tr("Tuition for {programName}, {registrationNo}", { programName: tr(tuition.account.programName), registrationNo: tuition.account.registrationNo })}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                  {tuition.payment.receivedAt ? tr("Marked received {value}", { value: formatDate(tuition.payment.receivedAt) }) : tr("Not yet marked received")}
                </p>
              </div>
              <div className="text-right">
                <ToneBadge tone="success">{tr("Paid")}</ToneBadge>
                <p className="mt-1 text-sm tabular-nums text-[var(--color-ink)]">{formatCurrency(tuition.payment.amount)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-soft)]">
              {tr("No approved payment at your institution has the bank code")}{" "}<span className="font-mono text-[var(--color-ink)]">{code}</span>. Check the code against the approval notice. Payments AOSA hasn&apos;t approved yet don&apos;t have a code.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
