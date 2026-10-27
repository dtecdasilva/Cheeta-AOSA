"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Info } from "lucide-react";
import { Card, CardHeader, DescriptionList, EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass, Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge, usePaged } from "@/components/admin/ui";
import {
  PAYMENT_STATUS_META,
  RECORD_STATUS_META,
  REVIEW_LABELS,
  VERIFICATION_META,
  figures,
  instalmentCoverage,
  type PaymentRecordStatus,
  type ReviewAction,
  type Reviewer,
  type TuitionAccount,
  type TuitionPayment,
} from "@/lib/tuition/data";
import { answerTuitionQuery, recordTuitionPayment, referenceInUse, reviewTuitionPayment, useTuitionAccounts, type ApiTuitionAccount } from "@/lib/tuition/api";
import { selectableParams, useParameterIndex, useParameters } from "@/lib/admin/parameters";
import { institutionStore } from "@/lib/admin/institutions";
import { matchesSearch } from "@/lib/admin/filters";
import { mockAnchor, useHydrated } from "@/lib/admin/store";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

// ---------------------------------------------------------------------------
// Badges and helpers
// ---------------------------------------------------------------------------

function VerificationBadge({ account }: { account: TuitionAccount }) {
  const tr = useT();
  const m = VERIFICATION_META[figures(account).verificationStatus];
  return <ToneBadge tone={m.tone}>{tr(m.label)}</ToneBadge>;
}

function PaymentStatusBadge({ account }: { account: TuitionAccount }) {
  const tr = useT();
  const m = PAYMENT_STATUS_META[figures(account).paymentStatus];
  return <ToneBadge tone={m.tone}>{tr(m.label)}</ToneBadge>;
}

function RecordBadge({ status }: { status: PaymentRecordStatus }) {
  const tr = useT();
  const m = RECORD_STATUS_META[status];
  return <ToneBadge tone={m.tone}>{tr(m.label)}</ToneBadge>;
}

function daysSince(iso: string) {
  return Math.max(0, Math.floor((mockAnchor().getTime() + 86_400_000 - new Date(iso).getTime()) / 86_400_000));
}

function NoProcessingNote({ role }: { role: "institution" | "admin" | "student" }) {
  const tr = useT();
  return (
    <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" strokeWidth={1.75} />
      {role === "student"
        ? tr("Pay your tuition using one of the institution's payment methods, then record the payment here. No money is taken on this platform. Payments count towards your tuition once AOSA has verified them. Each verified payment gets a bank code.")
        : role === "admin"
          ? tr("No money moves here. Verifying confirms that a payment the student recorded has actually arrived, and issues a bank code. Until then the institution only sees the student's first name and \"awaiting payment\". Only verified payments reduce the outstanding amount.")
          : tr("No money moves here. AOSA verifies every payment. Until it does, you'll see only the student's first name and \"awaiting payment\". Verified payments appear under a bank code: find each one on your statement and mark it received.")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function TuitionList({ basePath, institutionId }: { basePath: string; institutionId?: string }) {
  const tr = useT();
  const { items: accounts, error: loadError } = useTuitionAccounts();
  const institutions = institutionStore.useItems();
  const index = useParameterIndex();
  const categories = useParameters("fee-categories");
  const instName = useMemo(() => new Map(institutions.map((i) => [i.id, i.name])), [institutions]);

  const [search, setSearch] = useState("");
  const [inst, setInst] = useState("");
  const [verification, setVerification] = useState("");
  const [payment, setPayment] = useState("");
  const [category, setCategory] = useState("");
  const [attention, setAttention] = useState("");

  const scoped = useMemo(() => accounts.filter((a) => !institutionId || a.institutionId === institutionId), [accounts, institutionId]);
  const withFigures = useMemo(() => scoped.map((a) => ({ a, f: figures(a) })), [scoped]);

  const filtered = withFigures
    .filter(
      ({ a, f }) =>
        (!inst || a.institutionId === inst) &&
        (!verification || f.verificationStatus === verification) &&
        (!payment || f.paymentStatus === payment) &&
        (!category || a.feeCategoryId === category) &&
        (!attention ||
          (attention === "to-verify" && f.pendingCount > 0) ||
          (attention === "overdue" && !!f.nextInstalment?.overdue) ||
          (attention === "sla" && !!f.oldestPendingAt && daysSince(f.oldestPendingAt) > 3)) &&
        matchesSearch(search, [a.studentName, a.registrationNo, a.applicationRef, a.programName, a.email, ...a.payments.flatMap((p) => [p.reference, p.bankCode])])
    )
    // Most urgent first: longest-waiting payment, then biggest balance.
    .sort((x, y) => (x.f.oldestPendingAt ?? "9").localeCompare(y.f.oldestPendingAt ?? "9") || y.f.outstanding - x.f.outstanding);

  const { slice, page, pages, setPage } = usePaged(filtered, 20);
  const sum = (k: "tuition" | "verified" | "awaiting" | "outstanding") => withFigures.reduce((s, x) => s + x.f[k], 0);
  const toVerify = withFigures.filter((x) => x.f.pendingCount > 0);
  const overSla = toVerify.filter((x) => x.f.oldestPendingAt && daysSince(x.f.oldestPendingAt) > 3).length;
  const clear = () => {
    setSearch("");
    setInst("");
    setVerification("");
    setPayment("");
    setCategory("");
    setAttention("");
  };

  return (
    <>
      {loadError && <div className="mb-4"><FormError>{tr(loadError)}</FormError></div>}
      <NoProcessingNote role={institutionId ? "institution" : "admin"} />
      <StatStrip
        columns={5}
        stats={[
          { label: tr("Admitted students"), value: scoped.length, detail: tr("{count} accepted their offer", { count: scoped.filter((a) => a.offerAccepted).length }) },
          { label: tr("Tuition due"), value: formatCurrency(sum("tuition")) },
          { label: tr("Verified"), value: formatCurrency(sum("verified")), detail: tr("{count} fully verified", { count: withFigures.filter((x) => x.f.verificationStatus === "VERIFIED").length }) },
          {
            label: tr("Awaiting verification"),
            value: formatCurrency(sum("awaiting")),
            detail: (
              <button type="button" onClick={() => setAttention("to-verify")} className="underline underline-offset-4">
                {toVerify.length} {toVerify.length === 1 ? "student" : "students"}
                {overSla ? tr(", {overSla} over 3 days", { overSla }) : ""}
              </button>
            ),
          },
          { label: tr("Outstanding"), value: formatCurrency(sum("outstanding")), detail: tr("{count} with an overdue instalment", { count: withFigures.filter((x) => x.f.nextInstalment?.overdue).length }) },
        ]}
      />

      <div className="mt-6">
        <FilterBar active={!!(search || inst || verification || payment || category || attention)} onClear={clear}>
          <SearchField value={search} onChange={setSearch} placeholder={tr("Student, registration no., reference or bank code")} />
          {!institutionId && (
            <FilterSelect
              label={tr("Institution")}
              value={inst}
              onChange={setInst}
              options={[...new Set(scoped.map((a) => a.institutionId))].map((id) => ({ value: id, label: instName.get(id) ?? id })).sort((a, b) => a.label.localeCompare(b.label))}
            />
          )}
          <FilterSelect
            label={tr("Needs attention")}
            value={attention}
            onChange={setAttention}
            allLabel={tr("Any")}
            options={[
              { value: "to-verify", label: tr("Payments to verify") },
              { value: "sla", label: tr("Waiting over 3 days") },
              { value: "overdue", label: tr("Instalment overdue") },
            ]}
          />
          <FilterSelect label={tr("Verification")} value={verification} onChange={setVerification} options={Object.entries(VERIFICATION_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect label={tr("Payment status")} value={payment} onChange={setPayment} options={Object.entries(PAYMENT_STATUS_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect label={tr("Fee category")} value={category} onChange={setCategory} options={categories.map((c) => ({ value: c.id, label: c.label }))} />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={scoped.length} noun={tr("admitted students")} />
      {filtered.length === 0 ? (
        <EmptyState message={scoped.length === 0 ? tr("No admitted students yet.") : tr("No students match these filters.")} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Student")}</Th>
              <Th>{institutionId ? tr("Program") : tr("Institution and program")}</Th>
              <Th className="text-right">{tr("Tuition")}</Th>
              <Th className="text-right">{tr("Verified")}</Th>
              <Th className="text-right">{tr("Outstanding")}</Th>
              <Th>{tr("Payment status")}</Th>
              <Th>{tr("Verification")}</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map(({ a, f }) => (
              <tr key={a.id}>
                <Td>
                  <Link href={`${basePath}/${a.id}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                    {tr(a.studentName)}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                    {tr(a.registrationNo)} · {a.applicationRef}
                  </p>
                </Td>
                <Td>
                  {!institutionId && <p className="text-[var(--color-ink)]">{instName.get(a.institutionId) ?? a.institutionId}</p>}
                  <p className={institutionId ? "text-[var(--color-ink)]" : "mt-0.5 text-xs text-[var(--color-ink-faint)]"}>{tr(a.programName)}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{index.get(a.feeCategoryId)?.label ?? "—"}</p>
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(a.tuitionAmount)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {formatCurrency(f.verified)}
                  {f.awaiting > 0 && <p className="mt-0.5 text-xs text-[var(--color-info)]">{tr("+ {value} to check", { value: formatCurrency(f.awaiting) })}</p>}
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {formatCurrency(f.outstanding)}
                  {f.nextInstalment?.overdue && <p className="mt-0.5 text-xs text-[var(--color-danger)]">{tr("Instalment overdue")}</p>}
                </Td>
                <Td>
                  <PaymentStatusBadge account={a} />
                </Td>
                <Td>
                  <VerificationBadge account={a} />
                  {f.oldestPendingAt && (
                    <p className={`mt-1 text-xs ${daysSince(f.oldestPendingAt) > 3 ? "text-[var(--color-danger)]" : "text-[var(--color-ink-faint)]"}`}>
                      {tr("Waiting {value}", { value: daysSince(f.oldestPendingAt) })} {daysSince(f.oldestPendingAt) === 1 ? "day" : "days"}
                    </p>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Account detail (institution / admin)
// ---------------------------------------------------------------------------

export function TuitionAccountView({
  id,
  basePath,
  reviewer,
  institutionId,
}: {
  id: string;
  basePath: string;
  reviewer: Reviewer;
  /** Institution portal: only this institution's accounts can be opened. */
  institutionId?: string;
}) {
  const tr = useT();
  const hydrated = useHydrated();
  const { items: accounts, loaded } = useTuitionAccounts();
  const institutions = institutionStore.useItems();
  const a = accounts.find((x) => x.id === id && (!institutionId || x.institutionId === institutionId));
  const [notice, setNotice] = useState("");

  if (!a) {
    if (!hydrated || !loaded) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
    return (
      <EmptyState
        message={tr("This tuition account doesn't exist, or belongs to another institution.")}
        action={
          <Link href={basePath} className={ButtonLinkClass("secondary")}>
            {tr("Back to tuition verification")}
          </Link>
        }
      />
    );
  }

  const institution = institutions.find((i) => i.id === a.institutionId);

  return (
    <>
      <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        {tr("All admitted students")}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-bold tracking-tight text-2xl text-[var(--color-ink)]">{tr(a.studentName)}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {tr(a.programName)} · {a.institutionName ?? institution?.name ?? a.institutionId} · {a.applicationRef}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PaymentStatusBadge account={a} />
          <VerificationBadge account={a} />
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {tr(notice)}
        </p>
      )}

      <AccountSummary account={a} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <PaymentRecords account={a} reviewer={reviewer} onNotice={setNotice} />
          <InstalmentSchedule account={a} />
        </div>
        <StudentCard account={a} institutionName={a.institutionName ?? institution?.name} admin={reviewer.role === "admin"} />
      </div>
    </>
  );
}

function AccountSummary({ account }: { account: TuitionAccount }) {
  const tr = useT();
  const f = figures(account);
  const index = useParameterIndex();
  const pct = (n: number) => (f.tuition ? Math.min(100, (n / f.tuition) * 100) : 0);
  return (
    <>
      <StatStrip
        columns={5}
        stats={[
          { label: tr("Tuition amount"), value: formatCurrency(f.tuition), detail: `${index.get(account.feeCategoryId)?.label ?? ""} · ${index.get(account.academicYearId)?.label ?? ""}` },
          { label: tr("Recorded by student"), value: formatCurrency(f.recorded), detail: PAYMENT_STATUS_META[f.paymentStatus].label },
          { label: tr("Verified"), value: formatCurrency(f.verified) },
          { label: tr("Awaiting verification"), value: formatCurrency(f.awaiting), detail: f.pendingCount ? `${f.pendingCount} ${f.pendingCount === 1 ? "payment" : "payments"}` : tr("Nothing to check") },
          {
            label: tr("Outstanding"),
            value: formatCurrency(f.outstanding),
            detail: f.nextInstalment ? (
              <span className={f.nextInstalment.overdue ? "text-[var(--color-danger)]" : undefined}>
                {tr(f.nextInstalment.label)} {f.nextInstalment.overdue ? tr("was due") : "due"} {formatDate(f.nextInstalment.dueDate)}
              </span>
            ) : (
              tr("Nothing left to pay")
            ),
          },
        ]}
      />
      <div className="mt-3" aria-hidden>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
          <div className="h-full bg-[var(--color-success)]" style={{ width: `${pct(f.verified)}%` }} />
          <div className="h-full bg-[var(--color-info)] opacity-60" style={{ width: `${Math.max(0, Math.min(100 - pct(f.verified), pct(f.awaiting)))}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-[var(--color-ink-faint)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />{tr("Verified")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-info)] opacity-60" />{tr("Awaiting verification")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-line)]" />{tr("Outstanding")}</span>
        </div>
      </div>
    </>
  );
}

type Decision = { paymentId: string; action: Exclude<ReviewAction, "RECORDED" | "ANSWERED"> } | null;

function PaymentRecords({ account, reviewer, onNotice, readOnly }: { account: TuitionAccount; reviewer?: Reviewer; onNotice?: (s: string) => void; readOnly?: boolean }) {
  const tr = useT();
  const index = useParameterIndex();
  const [decision, setDecision] = useState<Decision>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [answer, setAnswer] = useState<{ paymentId: string; note: string } | null>(null);
  const payments = [...account.payments].sort((x, y) => y.recordedAt.localeCompare(x.recordedAt));

  async function sendAnswer() {
    if (!answer) return;
    const r = await answerTuitionQuery(answer.paymentId, answer.note);
    if (!r.ok) return setActionError(r.error);
    setActionError("");
    setAnswer(null);
    onNotice?.(tr("Answer sent. The payment is back with Cheeta administration for checking."));
  }

  return (
    <Card padded={false}>
      <CardHeader title={tr("Payment records")} description={readOnly ? tr("Payments you've recorded and what Cheeta administration decided.") : tr("Check each payment against the collection account statement.")} />
      {actionError && (
        <div className="px-5 pt-4">
          <FormError>{tr(actionError)}</FormError>
        </div>
      )}
      {payments.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">{tr("No payments recorded yet.")}</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {payments.map((p) => {
            const method = index.get(p.methodId);
            const dup = referenceInUse(p.reference, p.id);
            const lastReview = [...p.reviews].reverse().find((r) => r.action !== "RECORDED");
            const canDecide = !readOnly && (p.status === "PENDING" || p.status === "QUERIED");
            return (
              <li key={p.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-medium tabular-nums text-[var(--color-ink)]">{formatCurrency(p.amount)}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                      {p.methodLabel || method?.label || tr("Unknown method")}{" "}{tr("· paid {value}", { value: formatDate(p.paidOn) })}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                      {String(method?.attrs.referenceLabel ?? tr("Reference"))}: <span className="font-mono text-[var(--color-ink)]">{p.reference}</span>{" "}{tr("· payer {payerName}", { payerName: p.payerName })}
                    </p>
                    <p className="mt-1 text-xs">
                      {p.receiptFile ? (
                        <a href={p.receiptUrl ?? undefined} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[var(--color-ink-soft)] underline underline-offset-4">
                          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {tr(p.receiptFile)}
                        </a>
                      ) : (
                        <span className="text-[var(--color-warning-strong)]">{tr("No receipt uploaded")}</span>
                      )}
                    </p>
                    {p.bankCode && (
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                        {tr("Bank code")}{" "}<span className="font-mono text-[var(--color-ink)]">{p.bankCode}</span>
                        {!readOnly && (p.receivedAt ? tr(", received by the institution {value}", { value: formatDate(p.receivedAt) }) : tr(", not yet marked received by the institution"))}
                      </p>
                    )}
                    {dup && !readOnly && (
                      <p className="mt-1 text-xs text-[var(--color-danger)]">
                        {tr("This reference is also recorded for {studentName} ({applicationRef}).", { studentName: dup.a.studentName, applicationRef: dup.a.applicationRef })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <RecordBadge status={p.status} />
                    <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{tr("Recorded {value}", { value: formatDateTime(p.recordedAt) })}</p>
                  </div>
                </div>

                {lastReview && (
                  <p className="mt-2 border-l-2 border-[var(--color-line-strong)] pl-3 text-sm text-[var(--color-ink-soft)]">
                    <span className="text-[var(--color-ink)]">{tr(REVIEW_LABELS[lastReview.action])}</span>{" "}{tr("by {by} on {value}", { by: lastReview.by, value: formatDate(lastReview.at) })}
                    {lastReview.reasonId && <>: {index.get(lastReview.reasonId)?.label ?? tr("reason removed")}</>}
                    {lastReview.note && <span className="block">“{tr(lastReview.note)}”</span>}
                  </p>
                )}

                {readOnly && p.status === "QUERIED" && (
                  <div className="mt-3 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-3 text-sm">
                    {answer?.paymentId === p.id ? (
                      <>
                        <Field label={tr("Your answer")}>
                          <TextArea rows={3} value={answer.note} onChange={(e) => setAnswer({ paymentId: p.id, note: e.target.value })} />
                        </Field>
                        <div className="mt-2 flex gap-2">
                          <PrimaryButton type="button" onClick={sendAnswer} disabled={answer.note.trim().length < 3}>
                            {tr("Send answer")}
                          </PrimaryButton>
                          <SecondaryButton type="button" onClick={() => setAnswer(null)}>
                            {tr("Cancel")}
                          </SecondaryButton>
                        </div>
                      </>
                    ) : (
                      <button type="button" onClick={() => setAnswer({ paymentId: p.id, note: "" })} className="font-medium text-[var(--color-warning-strong)] underline underline-offset-4">
                        {tr("Answer the question about this payment")}
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  {canDecide && decision?.paymentId !== p.id && (
                    <>
                      <button type="button" onClick={() => setDecision({ paymentId: p.id, action: "VERIFIED" })} className="font-medium text-[var(--color-success-strong)] underline underline-offset-4">
                        {tr("Verify")}
                      </button>
                      {p.status !== "QUERIED" && (
                        <button type="button" onClick={() => setDecision({ paymentId: p.id, action: "QUERIED" })} className="text-[var(--color-warning-strong)] underline underline-offset-4">
                          {tr("Query")}
                        </button>
                      )}
                      <button type="button" onClick={() => setDecision({ paymentId: p.id, action: "REJECTED" })} className="text-[var(--color-danger)] underline underline-offset-4">
                        {tr("Reject")}
                      </button>
                    </>
                  )}
                  {!readOnly && (p.status === "VERIFIED" || p.status === "REJECTED") && decision?.paymentId !== p.id && (
                    <button type="button" onClick={() => setDecision({ paymentId: p.id, action: "REOPENED" })} className="text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                      {tr("Reopen")}
                    </button>
                  )}
                  <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                    {open === p.id ? tr("Hide history") : tr("History ({count})", { count: p.reviews.length })}
                  </button>
                </div>

                {decision?.paymentId === p.id && reviewer && (
                  <DecisionForm
                    payment={p}
                    action={decision.action}
                    duplicate={!!dup}
                    onCancel={() => setDecision(null)}
                    onConfirm={async (note, reasonId) => {
                      const action = decision.action as "VERIFIED" | "QUERIED" | "REJECTED" | "REOPENED";
                      const result = await reviewTuitionPayment(p.id, action, note, reasonId);
                      if (!result.ok) {
                        setActionError(result.error);
                        return;
                      }
                      setActionError("");
                      setDecision(null);
                      const code = result.data.payments.find((x) => x.id === p.id)?.bankCode;
                      onNotice?.(
                        decision.action === "VERIFIED"
                          ? tr("{value} verified with bank code {code}. It counts towards {studentName}'s tuition, and the institution can now see it.", { value: formatCurrency(p.amount), code, studentName: account.studentName })
                          : decision.action === "QUERIED"
                            ? tr("Query sent to {studentName}.", { studentName: account.studentName })
                            : decision.action === "REJECTED"
                              ? tr("Payment rejected. {studentName} will be told why.", { studentName: account.studentName })
                              : tr("Payment reopened and back in the queue.")
                      );
                    }}
                  />
                )}

                {open === p.id && (
                  <ol className="mt-3 border-t border-[var(--color-line)] pt-3">
                    {p.reviews.map((r, i) => (
                      <li key={i} className="relative border-l border-[var(--color-line)] pb-3 pl-4 last:pb-0">
                        <span className="absolute -left-[4px] top-1.5 h-2 w-2 rounded-full bg-[var(--color-ink-faint)]" />
                        <p className="text-sm text-[var(--color-ink)]">
                          {tr(REVIEW_LABELS[r.action])} <span className="text-[var(--color-ink-soft)]">{tr("by {by}", { by: r.by })}{r.role === "admin" ? tr(" (AOSA administration)") : ""}</span>
                        </p>
                        <p className="text-xs text-[var(--color-ink-faint)]">{formatDateTime(r.at)}</p>
                        {r.reasonId && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{tr("Reason:")}{" "}{index.get(r.reasonId)?.label ?? "—"}</p>}
                        {r.note && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">“{tr(r.note)}”</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function DecisionForm({
  payment,
  action,
  duplicate,
  onCancel,
  onConfirm,
}: {
  payment: TuitionPayment;
  action: Exclude<ReviewAction, "RECORDED" | "ANSWERED">;
  duplicate: boolean;
  onCancel: () => void;
  onConfirm: (note: string, reasonId?: string) => void;
}) {
  const tr = useT();
  const reasons = useParameters("rejection-reasons");
  const options = selectableParams(reasons).filter((r) => r.attrs.appliesTo === "payment");
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);

  const copy = {
    VERIFIED: { title: tr("Verify this payment"), button: "Verify payment", noteLabel: tr("Note (optional)") },
    QUERIED: { title: tr("Ask the student about this payment"), button: "Send query", noteLabel: tr("What do you need from the student?") },
    REJECTED: { title: tr("Reject this payment"), button: "Reject payment", noteLabel: tr("Extra detail for the student (optional)") },
    REOPENED: { title: tr("Reopen this payment for review"), button: "Reopen", noteLabel: tr("Why is it being reopened?") },
  }[action];

  function submit() {
    if (action === "VERIFIED" && !checked) return setError(tr("Confirm you've found this payment in the account statement."));
    if (action === "REJECTED" && !reasonId) return setError(tr("Choose a reason. The student sees it."));
    if ((action === "QUERIED" || action === "REOPENED") && !note.trim()) return setError(action === "QUERIED" ? tr("Tell the student what you need.") : tr("Give a reason for reopening."));
    onConfirm(note, action === "REJECTED" ? reasonId : undefined);
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">{tr(copy.title)}</p>
      <div className="space-y-4">
        {action === "VERIFIED" && (
          <>
            {duplicate && <FormError>{tr("The same reference appears on another account. Check it isn't the same payment before verifying.")}</FormError>}
            <label className="flex items-start gap-2 text-sm text-[var(--color-ink)]">
              <input type="checkbox" checked={checked} onChange={(e) => { setChecked(e.target.checked); setError(""); }} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
              {tr("I found {value} with reference {reference} on the collection account statement. Verifying issues a bank code and shows this payment to the institution.", { value: formatCurrency(payment.amount), reference: payment.reference })}
            </label>
          </>
        )}
        {action === "REJECTED" && (
          <Field label={tr("Reason")} required hint={tr("Managed in Application parameters → Rejection reasons.")}>
            <SelectInput value={reasonId} onChange={(e) => { setReasonId(e.target.value); setError(""); }}>
              <option value="">{tr("Select a reason…")}</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {tr(r.label)}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
        <Field label={tr(copy.noteLabel)} required={action === "QUERIED" || action === "REOPENED"}>
          <TextArea rows={2} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} />
        </Field>
        {error && <FormError>{tr(error)}</FormError>}
        <div className="flex items-center gap-3">
          <PrimaryButton type="button" onClick={submit}>
            {tr(copy.button)}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onCancel}>
            {tr("Cancel")}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function InstalmentSchedule({ account }: { account: TuitionAccount }) {
  const tr = useT();
  const rows = instalmentCoverage(account);
  const tone = { covered: "success", part: "amber", overdue: "danger", due: "neutral" } as const;
  const label = { covered: "Covered", part: "Part covered", overdue: "Overdue", due: "Not yet due" } as const;
  return (
    <Card padded={false}>
      <CardHeader title={tr("Instalment schedule")} description={tr("Verified payments are applied to instalments in order.")} />
      <TableFrame>
        <thead>
          <tr>
            <Th>{tr("Instalment")}</Th>
            <Th>{tr("Due")}</Th>
            <Th className="text-right">{tr("Amount")}</Th>
            <Th className="text-right">{tr("Covered")}</Th>
            <Th>{tr("State")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <Td>{tr(r.label)}</Td>
              <Td className="whitespace-nowrap">{formatDate(r.dueDate)}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.amount)}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.covered)}</Td>
              <Td>
                <ToneBadge tone={tone[r.state]}>{label[r.state]}</ToneBadge>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableFrame>
    </Card>
  );
}

function StudentCard({ account, institutionName, admin }: { account: TuitionAccount; institutionName?: string; admin: boolean }) {
  const tr = useT();
  const index = useParameterIndex();
  const studentLink = admin && account.studentId.startsWith("stu-0");
  return (
    <Card padded={false} className="self-start">
      <CardHeader title={tr("Admitted student")} />
      <DescriptionList
        items={[
          { label: tr("Name"), value: studentLink ? <Link href={`/admin/students/${account.studentId}`} className="underline underline-offset-4">{tr(account.studentName)}</Link> : account.studentName },
          { label: tr("Registration no."), value: account.registrationNo },
          { label: tr("Email"), value: account.email },
          { label: tr("Phone"), value: account.phone },
          { label: tr("Application"), value: admin && account.applicationId.startsWith("app-0") ? <Link href={`/admin/applications/${account.applicationId}`} className="underline underline-offset-4">{account.applicationRef}</Link> : account.applicationRef },
          ...(institutionName ? [{ label: tr("Institution"), value: institutionName }] : []),
          { label: tr("Program"), value: account.programName },
          { label: tr("Admitted"), value: formatDate(account.admittedAt) },
          { label: tr("Offer"), value: account.offerAccepted ? tr("Accepted by student") : tr("Awaiting student's reply") },
          { label: tr("Fee category"), value: index.get(account.feeCategoryId)?.label ?? "—" },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Student view
// ---------------------------------------------------------------------------

export function StudentTuition() {
  const tr = useT();
  const hydrated = useHydrated();
  const { items, loaded, error } = useTuitionAccounts();
  if (error) return <FormError>{tr(error)}</FormError>;
  if (!hydrated || !loaded) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  if (!items.length) return <EmptyState message={tr("You don't have a tuition account yet. It opens when you take up an offer of admission.")} />;
  return (
    <div className="space-y-10">
      {items.map((a) => (
        <StudentTuitionAccount key={a.id} a={a} />
      ))}
    </div>
  );
}

function StudentTuitionAccount({ a }: { a: ApiTuitionAccount }) {
  const tr = useT();
  const institutions = institutionStore.useItems();
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const institution = institutions.find((i) => i.id === a.institutionId);
  const f = figures(a);

  return (
    <>
      <NoProcessingNote role="student" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr(a.programName)}</p>
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
            {a.institutionName ?? institution?.name} · {a.applicationRef}{a.admissionNumber ? ` · ${a.admissionNumber}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentStatusBadge account={a} />
          <VerificationBadge account={a} />
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {tr(notice)}
        </p>
      )}

      <AccountSummary account={a} />

      <div className="mt-6 space-y-6">
        {f.outstanding > 0 &&
          (recording ? (
            <RecordPaymentForm
              account={a}
              onCancel={() => setRecording(false)}
              onSaved={(amount) => {
                setRecording(false);
                setNotice(tr("{value} recorded. Cheeta administration will verify it and issue a bank code. It counts towards your tuition once verified.", { value: formatCurrency(amount) }));
              }}
            />
          ) : (
            <div>
              <PrimaryButton type="button" onClick={() => { setRecording(true); setNotice(""); }}>
                {tr("Record a payment I've made")}
              </PrimaryButton>
            </div>
          ))}
        <PaymentRecords account={a} readOnly onNotice={setNotice} />
        <InstalmentSchedule account={a} />
      </div>
    </>
  );
}

function RecordPaymentForm({ account, onCancel, onSaved }: { account: ApiTuitionAccount; onCancel: () => void; onSaved: (amount: number) => void }) {
  const tr = useT();
  const options = account.paymentMethods ?? [];
  const [form, setForm] = useState({ methodId: "", reference: "", amount: "", paidOn: "", payerName: account.studentName });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const method = options.find((m) => m.id === form.methodId);
  const today = new Date().toISOString().slice(0, 10);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  async function save() {
    const e: Record<string, string> = {};
    const amount = Number(form.amount.replace(/\s/g, ""));
    if (!form.methodId) e.methodId = tr("Choose how you paid.");
    if (!form.reference.trim()) e.reference = tr("Enter the reference from your receipt.");
    if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) e.amount = tr("Enter the amount you paid, in {currency}.", { currency: account.currency });
    if (!form.paidOn) e.paidOn = tr("Enter the date you paid.");
    else if (form.paidOn > today) e.paidOn = tr("The payment date can't be in the future.");
    if (!form.payerName.trim()) e.payerName = tr("Enter the name on the receipt.");
    setErrors(e);
    if (Object.values(e).some(Boolean) || saving) return;
    setSaving(true);
    const r = await recordTuitionPayment(account.id, { paymentMethodId: form.methodId, reference: form.reference.trim(), amount, paidOn: form.paidOn, payerName: form.payerName.trim(), receipt });
    setSaving(false);
    if (!r.ok) {
      setErrors({ ...r.fieldErrors, methodId: r.fieldErrors.paymentMethodId ?? "", receiptFile: r.fieldErrors.receiptFileId ?? "" });
      setServerError(Object.keys(r.fieldErrors).length ? "" : r.error);
      return;
    }
    onSaved(amount);
  }

  return (
    <Card>
      <p className="mb-1 font-semibold text-base text-[var(--color-ink)]">{tr("Record a tuition payment")}</p>
      <p className="mb-4 text-sm text-[var(--color-ink-soft)]">{tr("Enter the details exactly as they appear on your receipt. This doesn't make a payment.")}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={tr("Payment method")} required error={errors.methodId}>
          <SelectInput value={form.methodId} onChange={(e) => set("methodId", e.target.value)}>
            <option value="">{tr("Select…")}</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {tr(m.label)}
              </option>
            ))}
          </SelectInput>
          {method && (method.accountNumber || method.instructions) && (
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{[method.accountName, method.accountNumber, method.instructions].filter(Boolean).join(" · ")}</p>
          )}
          {!options.length && <p className="mt-1 text-xs text-[var(--color-warning-strong)]">{tr("The institution hasn't set up a way to pay tuition yet. Contact its bursary.")}</p>}
        </Field>
        <Field label={tr("Payment reference")} required error={errors.reference}>
          <TextInput value={form.reference} onChange={(e) => set("reference", e.target.value)} className="font-mono" />
        </Field>
        <Field label={tr("Amount paid ({currency})", { currency: account.currency })} required error={errors.amount}>
          <TextInput inputMode="numeric" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder={String(figures(account).nextInstalment?.amount ?? "")} />
        </Field>
        <Field label={tr("Date paid")} required error={errors.paidOn}>
          <TextInput type="date" max={today} value={form.paidOn} onChange={(e) => set("paidOn", e.target.value)} />
        </Field>
        <Field label={tr("Name on the receipt")} required error={errors.payerName} hint={tr("If someone paid for you, enter their name.")}>
          <TextInput value={form.payerName} onChange={(e) => set("payerName", e.target.value)} />
        </Field>
        <Field label={tr("Receipt")} hint={tr("PDF, JPG or PNG. Speeds up verification.")} error={errors.receiptFile}>
          <TextInput type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
        </Field>
      </div>
      {serverError && (
        <div className="mt-4">
          <FormError>{tr(serverError)}</FormError>
        </div>
      )}
      <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
        <PrimaryButton type="button" onClick={save} disabled={saving}>
          {saving ? tr("Recording…") : tr("Record payment")}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          {tr("Cancel")}
        </SecondaryButton>
      </div>
    </Card>
  );
}
