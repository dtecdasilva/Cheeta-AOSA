"use client";

import { useEffect, useState } from "react";
import { Lock, Search } from "lucide-react";
import { EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { FormError, TextInput } from "@/components/Form";
import { FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge } from "@/components/admin/ui";
import { useMoneyFormat } from "@/lib/currency/useCurrencies";
import { BANK_CODE_HINT, normalizeBankCode } from "@/lib/payments/privacy";
import { findByBankCode, useInstitutionFees, type InstitutionFee } from "@/lib/payments/records";
import { buttonClass } from "@/lib/ui/button";
import { formatDate } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

type PaidFee = Extract<InstitutionFee, { state: "PAID" }>;

/**
 * Application fees as an institution sees them, from
 * /api/institution/fee-payments. The server sends only what the
 * institution may know: an applicant whose payment Cheeta administration
 * has approved, by name and bank code with the institution's own fee; and
 * for anyone still being checked, a masked name and nothing else. The
 * institution doesn't verify payments, so there is nothing to act on here.
 */
export function InstitutionApplicationFees() {
  const tr = useT();
  const money = useMoneyFormat();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const { fees, summary, total, pages, error } = useInstitutionFees({ state, q }, page);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const all = summary ? summary.awaiting + summary.paid : 0;

  return (
    <>
      <StatStrip
        columns={3}
        stats={[
          { label: tr("Awaiting payment"), value: summary?.awaiting ?? "…", detail: tr("Being checked by AOSA") },
          { label: tr("Paid"), value: summary?.paid ?? "…", detail: tr("Approved by AOSA") },
          { label: tr("Application fees approved"), value: summary ? money(summary.applicationFees, summary.currency) : "…" },
        ]}
      />
      <div className="mt-6">
        <FeeBankCodeLookup />
      </div>
      <div className="mt-6">
        <FilterBar
          active={!!(search || state)}
          onClear={() => {
            setSearch("");
            setState("");
            setPage(1);
          }}
        >
          <SearchField value={search} onChange={setSearch} placeholder={tr("Applicant, application or bank code")} />
          <FilterSelect
            label={tr("Status")}
            value={state}
            onChange={(v) => (setState(v), setPage(1))}
            options={[
              { value: "AWAITING", label: tr("Awaiting payment") },
              { value: "PAID", label: tr("Paid") },
            ]}
          />
        </FilterBar>
      </div>
      {error && (
        <div className="mt-4">
          <FormError>{tr(error)}</FormError>
        </div>
      )}
      <ResultCount shown={total} total={all} noun={tr("applicants")} />
      {!fees ? (
        !error && <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading application fees…")}</p>
      ) : fees.length === 0 ? (
        <EmptyState message={all === 0 ? tr("No application fee payments yet.") : tr("No applicants match these filters.")} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Applicant")}</Th>
              <Th>{tr("Status")}</Th>
              <Th>{tr("Application")}</Th>
              <Th>{tr("Bank code")}</Th>
              <Th className="text-right">{tr("Application fee")}</Th>
              <Th>{tr("Approved")}</Th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) =>
              fee.state === "AWAITING" ? (
                <tr key={fee.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                      <Lock className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden />
                      {tr(fee.displayName)}
                    </span>
                  </Td>
                  <Td colSpan={5}>
                    <ToneBadge tone="info">{tr("Awaiting payment")}</ToneBadge>
                  </Td>
                </tr>
              ) : (
                <tr key={fee.id}>
                  <Td className="text-[var(--color-ink)]">{fee.displayName}</Td>
                  <Td>
                    <ToneBadge tone="success">{tr("Paid")}</ToneBadge>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{tr(fee.applicationReference)}</p>
                    {fee.programName && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(fee.programName)}</p>}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs text-[var(--color-ink)]">{fee.bankCode}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{money(fee.applicationFee, fee.currency)}</Td>
                  <Td className="whitespace-nowrap">{formatDate(fee.approvedAt)}</Td>
                </tr>
              )
            )}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}

/**
 * Identify a paid applicant by the bank code issued when their payment
 * was approved. The server only ever finds an approved payment at the
 * signed-in institution; a code for anything else finds nothing, and the
 * answer doesn't say which, so the lookup can't be used to probe.
 */
function FeeBankCodeLookup() {
  const tr = useT();
  const money = useMoneyFormat();
  const [input, setInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<{ code: string; fee: PaidFee | null; error?: string } | null>(null);

  async function find() {
    const code = normalizeBankCode(input);
    if (!code || looking) return;
    setLooking(true);
    const answer = await findByBankCode(code);
    setLooking(false);
    setResult(answer.ok ? { code, fee: answer.fee } : { code, fee: null, error: answer.error });
  }

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 sm:p-5" aria-labelledby="bank-code-lookup">
      <h2 id="bank-code-lookup" className="font-semibold text-base text-[var(--color-ink)]">
        {tr("Find a paid applicant by bank code")}
      </h2>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{tr(BANK_CODE_HINT)}</span>
          <TextInput value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr("BK26-A7KQ-M9TX")} className="font-mono uppercase" autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" className={buttonClass("primary")} disabled={looking}>
          <Search className="h-4 w-4" strokeWidth={1.75} />
          {looking ? tr("Looking…") : tr("Find applicant")}
        </button>
      </form>

      {result && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4" role="status" aria-live="polite">
          {result.error ? (
            <FormError>{tr(result.error)}</FormError>
          ) : result.fee ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">{tr(result.fee.displayName)}</p>
                <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                  {tr("Application fee")}{result.fee.programName ? ` for ${result.fee.programName}` : ""}{tr(", application {applicationReference}", { applicationReference: result.fee.applicationReference })}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr("Approved by AOSA {value}", { value: formatDate(result.fee.approvedAt) })}</p>
              </div>
              <div className="text-right">
                <ToneBadge tone="success">{tr("Paid")}</ToneBadge>
                <p className="mt-1 text-sm tabular-nums text-[var(--color-ink)]">{money(result.fee.applicationFee, result.fee.currency)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-soft)]">
              {tr("No approved payment at your institution has the bank code")}{" "}<span className="font-mono text-[var(--color-ink)]">{result.code}</span>. Check the code against the approval notice. Payments AOSA hasn&apos;t approved yet don&apos;t have a code.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
