"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Info, Lock } from "lucide-react";
import { EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton, TextArea } from "@/components/Form";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge, usePaged } from "@/components/admin/ui";
import { BankCodeLookup } from "./BankCodeLookup";
import {
  FEE_APPROVAL_META,
  approveFeePayment,
  feePaymentStore,
  institutionFeeView,
  rejectFeePayment,
  reopenFeePayment,
  type FeePayment,
} from "@/lib/payments/applicationFees";
import { institutionTuitionView, tuitionStore } from "@/lib/tuition/data";
import { institutionStore } from "@/lib/admin/institutions";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Admin: approve application fee payments
// ---------------------------------------------------------------------------

type Pending = { id: string; action: "approve" | "reject" | "reopen" } | null;

export function AdminFeeApprovals({ reviewerName }: { reviewerName: string }) {
  const fees = feePaymentStore.useItems();
  const institutions = institutionStore.useItems();
  const instName = useMemo(() => new Map(institutions.map((i) => [i.id, i.name])), [institutions]);

  const [search, setSearch] = useState("");
  const [inst, setInst] = useState("");
  const [approval, setApproval] = useState("AWAITING");
  const [method, setMethod] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filtered = fees
    .filter(
      (f) =>
        (!inst || f.institutionId === inst) &&
        (!approval || f.approval === approval) &&
        (!method || f.method === method) &&
        inRange(f.submittedAt, range) &&
        matchesSearch(search, [f.firstName, f.lastName, f.applicationRef, f.reference, f.bankCode, f.email, instName.get(f.institutionId)])
    )
    // Oldest waiting first; everything else newest first.
    .sort((a, b) => (a.approval === "AWAITING" && b.approval === "AWAITING" ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt)));

  const { slice, page, pages, setPage } = usePaged(filtered, 20);
  const awaiting = fees.filter((f) => f.approval === "AWAITING");
  const approved = fees.filter((f) => f.approval === "APPROVED");
  const methods = [...new Set(fees.map((f) => f.method))].sort();

  function close() {
    setPending(null);
    setNote("");
    setError("");
  }

  function confirm(f: FeePayment) {
    if (!pending) return;
    const name = `${f.firstName} ${f.lastName}`;
    if (pending.action === "approve") {
      const code = approveFeePayment(f.id, reviewerName, note);
      setNotice(`Approved ${name}'s payment. Bank code ${code} issued; ${instName.get(f.institutionId) ?? "the institution"} can now see this student as paid.`);
    } else if (pending.action === "reject") {
      if (!note.trim()) return setError("Tell the student why. They see this note.");
      rejectFeePayment(f.id, reviewerName, note);
      setNotice(`Rejected ${name}'s payment. The institution still sees them as awaiting payment.`);
    } else {
      reopenFeePayment(f.id);
      setNotice(`${name}'s payment is back in the queue. Its bank code was withdrawn.`);
    }
    close();
  }

  return (
    <>
      <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" strokeWidth={1.75} />
        Only AOSA sees these payment details and the web fee. Institutions see a student as &ldquo;awaiting payment&rdquo; until you approve. Approving issues the bank code the institution uses to identify the paid student.
      </p>

      <StatStrip
        columns={4}
        stats={[
          { label: "Awaiting approval", value: awaiting.length, detail: formatCurrency(awaiting.reduce((s, f) => s + f.amount, 0)) },
          { label: "Approved", value: approved.length, detail: `${formatCurrency(approved.reduce((s, f) => s + f.applicationFee, 0))} in application fees` },
          { label: "Web fees approved", value: formatCurrency(approved.reduce((s, f) => s + f.webFee, 0)), detail: "Not visible to institutions" },
          { label: "Rejected", value: fees.filter((f) => f.approval === "REJECTED").length },
        ]}
      />

      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {notice}
        </p>
      )}

      <div className="mt-6">
        <FilterBar active={!!(search || inst || approval !== "AWAITING" || method || range.from || range.to)} onClear={() => { setSearch(""); setInst(""); setApproval("AWAITING"); setMethod(""); setRange(EMPTY_RANGE); }}>
          <SearchField value={search} onChange={setSearch} placeholder="Student, application, payment reference or bank code" />
          <FilterSelect label="Approval" value={approval} onChange={setApproval} options={Object.entries(FEE_APPROVAL_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect label="Institution" value={inst} onChange={setInst} options={[...new Set(fees.map((f) => f.institutionId))].map((id) => ({ value: id, label: instName.get(id) ?? id })).sort((a, b) => a.label.localeCompare(b.label))} />
          <FilterSelect label="Method" value={method} onChange={setMethod} options={methods.map((m) => ({ value: m, label: m }))} />
          <DateRangeFilter value={range} onChange={setRange} label="Recorded" />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={fees.length} noun="application fee payments" />
      {filtered.length === 0 ? (
        <EmptyState message={approval === "AWAITING" ? "Nothing waiting for approval." : "No payments match these filters."} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Institution and program</Th>
              <Th>Payment</Th>
              <Th className="text-right">Amount</Th>
              <Th>Approval</Th>
              <Th className="w-56" />
            </tr>
          </thead>
          <tbody>
            {slice.map((f) => {
              const m = FEE_APPROVAL_META[f.approval];
              const open = pending?.id === f.id;
              return (
                <tr key={f.id} className="align-top">
                  <Td>
                    <p className="text-[var(--color-ink)]">
                      {f.firstName} {f.lastName}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{f.applicationRef}</p>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{instName.get(f.institutionId) ?? f.institutionId}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{f.programName}</p>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{f.method}</p>
                    <p className="mt-0.5 font-mono text-xs text-[var(--color-ink-soft)]">{f.reference}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Paid {formatDate(f.paidAt)}, recorded {formatDateTime(f.submittedAt)}</p>
                    <p className="mt-0.5 text-xs">
                      {f.receiptFile ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-ink-soft)]">
                          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {f.receiptFile}
                        </span>
                      ) : (
                        <span className="text-[var(--color-warning-strong)]">No receipt uploaded</span>
                      )}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    <p className="text-[var(--color-ink)]">{formatCurrency(f.amount)}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                      {formatCurrency(f.applicationFee)} + {formatCurrency(f.webFee)} web
                    </p>
                  </Td>
                  <Td>
                    <ToneBadge tone={m.tone}>{m.label}</ToneBadge>
                    {f.bankCode && <p className="mt-1 font-mono text-xs text-[var(--color-ink)]">{f.bankCode}</p>}
                    {f.reviewedAt && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{formatDate(f.reviewedAt)}</p>}
                    {f.note && <p className="mt-1 max-w-[16rem] text-xs text-[var(--color-ink-soft)]">&ldquo;{f.note}&rdquo;</p>}
                  </Td>
                  <Td className="text-right">
                    {open ? (
                      <div className="space-y-2 text-left">
                        <p className="text-sm font-medium text-[var(--color-ink)]">
                          {pending.action === "approve" ? "Approve and issue a bank code?" : pending.action === "reject" ? "Reject this payment" : "Reopen and withdraw the bank code?"}
                        </p>
                        {pending.action !== "reopen" && (
                          <TextArea rows={2} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} placeholder={pending.action === "reject" ? "Reason, shown to the student" : "Note (optional)"} aria-label="Note" />
                        )}
                        {error && <FormError>{error}</FormError>}
                        <div className="flex flex-wrap gap-2">
                          <PrimaryButton type="button" onClick={() => confirm(f)}>
                            {pending.action === "approve" ? "Approve" : pending.action === "reject" ? "Reject" : "Reopen"}
                          </PrimaryButton>
                          <SecondaryButton type="button" onClick={close}>
                            Cancel
                          </SecondaryButton>
                        </div>
                      </div>
                    ) : f.approval === "AWAITING" ? (
                      <span className="inline-flex gap-4 text-sm">
                        <button type="button" onClick={() => { setPending({ id: f.id, action: "approve" }); setNotice(""); }} className="font-medium text-[var(--color-success-strong)] underline underline-offset-4">
                          Approve
                        </button>
                        <button type="button" onClick={() => { setPending({ id: f.id, action: "reject" }); setNotice(""); }} className="text-[var(--color-danger)] underline underline-offset-4">
                          Reject
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => { setPending({ id: f.id, action: "reopen" }); setNotice(""); }} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                        Reopen
                      </button>
                    )}
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

// ---------------------------------------------------------------------------
// Institution: who has paid, by bank code
// ---------------------------------------------------------------------------

export function InstitutionFeePayments({ institutionId }: { institutionId: string }) {
  const fees = feePaymentStore.useItems();
  const views = useMemo(() => fees.filter((f) => f.institutionId === institutionId).map(institutionFeeView), [fees, institutionId]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");

  const filtered = views
    .filter((v) => (!state || v.state === state) && matchesSearch(search, v.state === "PAID" ? [v.displayName, v.applicationRef, v.programName, v.bankCode] : [v.displayName]))
    .sort((a, b) => (a.state === b.state ? a.displayName.localeCompare(b.displayName) : a.state === "AWAITING" ? -1 : 1));
  const { slice, page, pages, setPage } = usePaged(filtered, 25);
  const paid = views.filter((v): v is Extract<typeof v, { state: "PAID" }> => v.state === "PAID");

  return (
    <>
      <StatStrip
        columns={3}
        stats={[
          { label: "Awaiting payment", value: views.length - paid.length, detail: "Being checked by AOSA" },
          { label: "Paid", value: paid.length, detail: "Approved by AOSA" },
          { label: "Application fees approved", value: formatCurrency(paid.reduce((s, v) => s + v.applicationFee, 0)) },
        ]}
      />
      <div className="mt-6">
        <BankCodeLookup institutionId={institutionId} tuitionHref="/institution/tuition" />
      </div>
      <div className="mt-6">
        <FilterBar active={!!(search || state)} onClear={() => { setSearch(""); setState(""); }}>
          <SearchField value={search} onChange={setSearch} placeholder="Student, application or bank code" />
          <FilterSelect label="Status" value={state} onChange={setState} options={[{ value: "AWAITING", label: "Awaiting payment" }, { value: "PAID", label: "Paid" }]} />
        </FilterBar>
      </div>
      <ResultCount shown={filtered.length} total={views.length} noun="applicants" />
      {filtered.length === 0 ? (
        <EmptyState message={views.length === 0 ? "No application fee payments yet." : "No applicants match these filters."} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Applicant</Th>
              <Th>Status</Th>
              <Th>Application</Th>
              <Th>Bank code</Th>
              <Th className="text-right">Application fee</Th>
              <Th>Approved</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((v) =>
              v.state === "AWAITING" ? (
                <tr key={v.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                      <Lock className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden />
                      {v.displayName}
                    </span>
                  </Td>
                  <Td colSpan={5}>
                    <ToneBadge tone="info">Awaiting payment</ToneBadge>
                  </Td>
                </tr>
              ) : (
                <tr key={v.id}>
                  <Td className="text-[var(--color-ink)]">{v.displayName}</Td>
                  <Td>
                    <ToneBadge tone="success">Paid</ToneBadge>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{v.applicationRef}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{v.programName}</p>
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs text-[var(--color-ink)]">{v.bankCode}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(v.applicationFee)}</Td>
                  <Td className="whitespace-nowrap">{formatDate(v.approvedAt)}</Td>
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

// ---------------------------------------------------------------------------
// Institution dashboard: the one-line "awaiting payment" list
// ---------------------------------------------------------------------------

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
