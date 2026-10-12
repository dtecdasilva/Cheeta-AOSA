"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Info } from "lucide-react";
import { EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea } from "@/components/Form";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge } from "@/components/admin/ui";
import { useMoneyFormat } from "@/lib/currency/useCurrencies";
import { EMPTY_RANGE, type DateRange } from "@/lib/admin/filters";
import { useOptions } from "@/lib/institution/api";
import { VERIFICATION_META, usePaymentRecords, type Decision, type PaymentFilters, type PaymentRecord } from "@/lib/payments/records";
import { formatDate, formatDateTime } from "@/lib/utils";

/**
 * Cheeta administration's desk for verifying the payments applicants
 * have recorded, from /api/admin/fee-payments.
 *
 * A payment arrives here as "Awaiting verification" and stays that way
 * until someone at this desk approves or rejects it; the platform never
 * marks one as paid by itself. Each row has what is needed to check the
 * payment against the bank or operator statement: the account it went
 * into, the reference, the date, who sent it and the evidence uploaded.
 * The server records who decided and when.
 */

type Pending = { id: string; action: "approve" | "reject" | "reopen" } | null;
type Reason = { id: string; label: string; attrs: { appliesTo?: string } };

const OTHER = "other";
const NO_FILTERS: PaymentFilters = { approval: "AWAITING", institutionId: "", method: "", from: "", to: "", q: "" };

export function PaymentVerificationDesk() {
  const money = useMoneyFormat();
  const [filters, setFilters] = useState<PaymentFilters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { records, summary, total, pages, error, decide } = usePaymentRecords(filters, page);
  const reasons = useOptions<Reason>("/api/reference/parameters?category=rejection-reasons").filter((r) => r.attrs.appliesTo === "payment");

  const [pending, setPending] = useState<Pending>(null);
  const [reasonId, setReasonId] = useState("");
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  // The search box is typed into; the list follows a moment after the typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function filter(patch: Partial<PaymentFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function open(id: string, action: NonNullable<Pending>["action"]) {
    setPending({ id, action });
    setReasonId("");
    setText("");
    setProblem("");
    setNotice("");
  }

  function close() {
    setPending(null);
    setProblem("");
  }

  async function confirm(p: PaymentRecord) {
    if (!pending || saving) return;
    let decision: Decision;
    if (pending.action === "approve") decision = { decision: "approve", note: text.trim() || undefined };
    else if (pending.action === "reopen") decision = { decision: "reopen" };
    else {
      const standard = reasonId && reasonId !== OTHER ? reasonId : undefined;
      if (!reasonId) return setProblem("Choose why the payment is rejected. The applicant sees this.");
      if (!standard && !text.trim()) return setProblem("Say why the payment is rejected. The applicant sees this.");
      decision = { decision: "reject", reasonId: standard, reason: text.trim() || undefined };
    }
    setSaving(true);
    const result = await decide(p.id, decision);
    setSaving(false);
    if (!result.ok) return setProblem(Object.values(result.fieldErrors)[0] ?? result.error);
    if (pending.action === "approve") setNotice(`Approved ${p.applicantName}'s payment. Bank code ${result.record.bankCode} issued; ${p.institutionName} can now see this applicant as paid.`);
    else if (pending.action === "reject") setNotice(`Rejected ${p.applicantName}'s payment. They have been told why and can record a payment again. ${p.institutionName} still sees them as awaiting payment.`);
    else setNotice(`${p.applicantName}'s payment is back in the queue${p.bankCode ? ". Its bank code was withdrawn" : ""}.`);
    close();
  }

  const range: DateRange = { from: filters.from, to: filters.to };
  const filtering = !!(search || filters.institutionId || filters.approval !== "AWAITING" || filters.method || filters.from || filters.to);
  const all = summary ? summary.awaiting.count + summary.approved.count + summary.rejected.count : 0;
  const base = summary?.currency ?? "XAF";

  return (
    <>
      <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" strokeWidth={1.75} />
        A payment is never marked as paid automatically. It waits here until you check it against the account statement and approve or reject it. Only Cheeta administration sees these details and the web fee; approving issues the bank code the institution identifies the paid applicant by.
      </p>

      <StatStrip
        columns={4}
        stats={[
          { label: "Awaiting verification", value: summary?.awaiting.count ?? "…", detail: summary ? money(summary.awaiting.amount, base) : undefined },
          { label: "Approved", value: summary?.approved.count ?? "…", detail: summary ? `${money(summary.approved.applicationFee, base)} in application fees` : undefined },
          { label: "Web fees approved", value: summary ? money(summary.approved.webFee, base) : "…", detail: "Not visible to institutions" },
          { label: "Rejected", value: summary?.rejected.count ?? "…" },
        ]}
      />

      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {notice}
        </p>
      )}

      <div className="mt-6">
        <FilterBar
          active={filtering}
          onClear={() => {
            setSearch("");
            setFilters(NO_FILTERS);
            setPage(1);
          }}
        >
          <SearchField value={search} onChange={setSearch} placeholder="Applicant, application, payment reference or bank code" />
          <FilterSelect label="Verification" value={filters.approval} onChange={(approval) => filter({ approval })} options={Object.entries(VERIFICATION_META).map(([value, m]) => ({ value, label: m.label }))} />
          <FilterSelect label="Institution" value={filters.institutionId} onChange={(institutionId) => filter({ institutionId })} options={(summary?.institutions ?? []).map((i) => ({ value: i.id, label: i.name }))} />
          <FilterSelect label="Method" value={filters.method} onChange={(method) => filter({ method })} options={(summary?.methods ?? []).map((m) => ({ value: m.id, label: m.label }))} />
          <DateRangeFilter value={range} onChange={(r) => filter({ from: r.from, to: r.to })} label="Recorded" />
        </FilterBar>
      </div>

      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}
      <ResultCount shown={total} total={all} noun="payment records" />
      {!records ? (
        !error && <p className="text-sm text-[var(--color-ink-soft)]">Loading payment records…</p>
      ) : records.length === 0 ? (
        <EmptyState message={filters.approval === "AWAITING" && !filtering ? "Nothing waiting to be verified." : "No payment records match these filters."} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Applicant</Th>
              <Th>Institution and program</Th>
              <Th>Payment</Th>
              <Th className="text-right">Amount</Th>
              <Th>Verification</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {records.map((p) => {
              const meta = VERIFICATION_META[p.approval];
              const isOpen = pending?.id === p.id;
              return (
                <tr key={p.id} className="align-top">
                  <Td>
                    <p className="text-[var(--color-ink)]">{p.applicantName}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{p.applicationReference}</p>
                    <p className="mt-0.5 break-all text-xs text-[var(--color-ink-faint)]">{p.applicantEmail}</p>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{p.institutionName}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{p.programName ?? "No program chosen yet"}</p>
                  </Td>
                  <Td className="min-w-[14rem]">
                    <p className="text-[var(--color-ink)]">{p.methodLabel}</p>
                    {p.paymentAccount && (
                      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                        Into {p.paymentAccount.label}: {p.paymentAccount.provider}, {p.paymentAccount.accountNumber}
                      </p>
                    )}
                    <p className="mt-0.5 break-all font-mono text-xs text-[var(--color-ink)]">{p.reference}</p>
                    {p.sameReferenceElsewhere > 0 && (
                      <p className="mt-0.5 flex items-start gap-1 text-xs text-[var(--color-warning-strong)]">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                        This reference is on {p.sameReferenceElsewhere} other application{p.sameReferenceElsewhere === 1 ? "" : "s"}.
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                      Paid {formatDate(p.paidAt)}, recorded {formatDateTime(p.submittedAt)}
                    </p>
                    {p.paidFrom && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Sent from {p.paidFrom}</p>}
                    <p className="mt-1 text-xs">
                      {p.evidence ? (
                        <a href={p.evidence.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[var(--color-ink)] underline underline-offset-4">
                          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          View receipt
                          <span className="sr-only">
                            {" "}
                            for {p.reference} ({p.evidence.name})
                          </span>
                        </a>
                      ) : (
                        <span className="text-[var(--color-warning-strong)]">No receipt uploaded</span>
                      )}
                    </p>
                  </Td>
                  <Td className="text-right tabular-nums">
                    <p className="whitespace-nowrap text-[var(--color-ink)]">{money(p.amount, p.currency)}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                      {money(p.applicationFee, p.currency)} + {money(p.webFee, p.currency)} web
                    </p>
                    {/* Conversions are the ones stored with the payment when it was recorded; today's rates play no part. */}
                    {p.feeConversion && (
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                        Fee set at {money(p.feeConversion.fromAmount, p.feeConversion.fromCurrency)}
                      </p>
                    )}
                    {p.displayConversion && (
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                        Shown to the applicant as {money(p.displayConversion.toAmount, p.displayConversion.toCurrency)}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                    {p.bankCode && <p className="mt-1 whitespace-nowrap font-mono text-xs text-[var(--color-ink)]">{p.bankCode}</p>}
                    {p.verifiedAt && (
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                        {p.verifiedBy?.name ? `By ${p.verifiedBy.name}, ` : ""}
                        {formatDate(p.verifiedAt)}
                      </p>
                    )}
                    {p.rejectionReason && <p className="mt-1 max-w-[16rem] text-xs text-[var(--color-ink-soft)]">Reason: {p.rejectionReason}</p>}
                    {p.note && <p className="mt-1 max-w-[16rem] text-xs text-[var(--color-ink-soft)]">Note: {p.note}</p>}
                  </Td>
                  {/* Narrow until a decision is being made in it, so the payment details keep the room. */}
                  <Td className={isOpen ? "min-w-[14rem] text-right" : "whitespace-nowrap text-right"}>
                    {isOpen ? (
                      <div className="space-y-2 text-left">
                        <p className="text-sm font-medium text-[var(--color-ink)]">
                          {pending.action === "approve" ? "Approve and issue a bank code?" : pending.action === "reject" ? "Reject this payment" : p.approval === "APPROVED" ? "Reopen and withdraw the bank code?" : "Reopen this payment?"}
                        </p>
                        {pending.action === "reject" && (
                          <SelectInput value={reasonId} onChange={(e) => (setReasonId(e.target.value), setProblem(""))} aria-label="Reason for rejecting">
                            <option value="">Choose a reason…</option>
                            {reasons.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                            <option value={OTHER}>Another reason</option>
                          </SelectInput>
                        )}
                        {pending.action !== "reopen" && (
                          <TextArea
                            rows={2}
                            value={text}
                            onChange={(e) => (setText(e.target.value), setProblem(""))}
                            maxLength={500}
                            placeholder={pending.action === "approve" ? "Note for the record (optional)" : reasonId === OTHER ? "Reason, shown to the applicant" : "Anything to add (optional)"}
                            aria-label={pending.action === "approve" ? "Note" : "Reason in your own words"}
                          />
                        )}
                        {pending.action === "reopen" && <p className="text-xs text-[var(--color-ink-soft)]">It goes back to awaiting verification. The decision made so far stays in the audit trail.</p>}
                        {problem && <FormError>{problem}</FormError>}
                        <div className="flex flex-wrap gap-2">
                          <PrimaryButton type="button" onClick={() => confirm(p)} disabled={saving}>
                            {saving ? "Saving…" : pending.action === "approve" ? "Approve" : pending.action === "reject" ? "Reject" : "Reopen"}
                          </PrimaryButton>
                          <SecondaryButton type="button" onClick={close} disabled={saving}>
                            Cancel
                          </SecondaryButton>
                        </div>
                      </div>
                    ) : p.approval === "AWAITING" ? (
                      <span className="inline-flex gap-4 text-sm">
                        <button type="button" onClick={() => open(p.id, "approve")} className="font-medium text-[var(--color-success-strong)] underline underline-offset-4">
                          Approve
                        </button>
                        <button type="button" onClick={() => open(p.id, "reject")} className="text-[var(--color-danger)] underline underline-offset-4">
                          Reject
                        </button>
                      </span>
                    ) : p.canReopen ? (
                      <button type="button" onClick={() => open(p.id, "reopen")} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                        Reopen
                      </button>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}
