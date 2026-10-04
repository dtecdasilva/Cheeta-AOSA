"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, Lock } from "lucide-react";
import { Card, CardHeader, DescriptionList, EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass } from "@/components/Form";
import { FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge, usePaged } from "@/components/admin/ui";
import { BankCodeLookup } from "@/components/payments/BankCodeLookup";
import { INSTITUTION_TUITION_META, institutionTuitionView, instalmentCoverage, markReceived, tuitionStore, type InstitutionTuitionView } from "@/lib/tuition/data";
import { matchesSearch } from "@/lib/admin/filters";
import { useHydrated } from "@/lib/admin/store";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * The institution's side of tuition. Everything here goes through
 * `institutionTuitionView`, which redacts what the institution may not
 * see. The institution doesn't verify payments (AOSA does); its job here
 * is to find each approved payment on its own statement and mark it
 * received.
 */

function Note() {
  return (
    <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" strokeWidth={1.75} />
      AOSA verifies every tuition payment. While a payment is being checked you see only the student&apos;s first name and &ldquo;awaiting payment&rdquo;. Once it&apos;s approved it appears here with a bank code: find it on your statement and mark it received.
    </p>
  );
}

function StateBadge({ v }: { v: InstitutionTuitionView }) {
  const m = INSTITUTION_TUITION_META[v.state];
  return <ToneBadge tone={m.tone}>{m.label}</ToneBadge>;
}

export function InstitutionTuitionList({ institutionId, basePath }: { institutionId: string; basePath: string }) {
  const accounts = tuitionStore.useItems();
  const views = useMemo(() => accounts.filter((a) => a.institutionId === institutionId).map(institutionTuitionView), [accounts, institutionId]);

  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [reconcile, setReconcile] = useState("");

  const filtered = views
    .filter(
      (v) =>
        (!state || v.state === state) &&
        (!reconcile || (reconcile === "to-reconcile" ? v.toReconcile > 0 : v.confirmedPayments.length > 0 && v.toReconcile === 0)) &&
        // Masked rows can only be found by the masked name.
        matchesSearch(search, v.masked ? [v.displayName] : [v.displayName, v.registrationNo, v.applicationRef, v.programName, ...v.confirmedPayments.map((p) => p.bankCode)])
    )
    .sort((x, y) => Number(y.toReconcile > 0) - Number(x.toReconcile > 0) || Number(x.masked) - Number(y.masked) || x.displayName.localeCompare(y.displayName));

  const { slice, page, pages, setPage } = usePaged(filtered, 25);
  const identified = views.filter((v) => !v.masked);
  const sum = (k: "confirmed" | "outstanding") => identified.reduce((s, v) => s + (v[k] ?? 0), 0);
  const awaiting = views.filter((v) => v.masked).length;
  const toReconcile = views.reduce((s, v) => s + v.toReconcile, 0);

  return (
    <>
      <Note />
      <StatStrip
        columns={5}
        stats={[
          { label: "Admitted students", value: views.length },
          { label: "Awaiting payment", value: awaiting, detail: "Being checked by AOSA" },
          { label: "Approved by AOSA", value: formatCurrency(sum("confirmed")), detail: `${identified.filter((v) => v.state === "PAID").length} paid in full` },
          {
            label: "To mark received",
            value: toReconcile,
            detail: toReconcile ? (
              <button type="button" onClick={() => setReconcile("to-reconcile")} className="underline underline-offset-4">
                Show them
              </button>
            ) : (
              "All reconciled"
            ),
          },
          { label: "Outstanding", value: formatCurrency(sum("outstanding")), detail: "Students with an approved payment or none yet" },
        ]}
      />

      <div className="mt-6">
        <BankCodeLookup institutionId={institutionId} tuitionHref={basePath} />
      </div>

      <div className="mt-6">
        <FilterBar active={!!(search || state || reconcile)} onClear={() => { setSearch(""); setState(""); setReconcile(""); }}>
          <SearchField value={search} onChange={setSearch} placeholder="Student, registration no. or bank code" />
          <FilterSelect label="Status" value={state} onChange={setState} options={Object.entries(INSTITUTION_TUITION_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect
            label="Reconciliation"
            value={reconcile}
            onChange={setReconcile}
            allLabel="Any"
            options={[
              { value: "to-reconcile", label: "Payments to mark received" },
              { value: "done", label: "All marked received" },
            ]}
          />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={views.length} noun="admitted students" />
      {filtered.length === 0 ? (
        <EmptyState message={views.length === 0 ? "No admitted students yet." : "No students match these filters."} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Program</Th>
              <Th className="text-right">Tuition</Th>
              <Th className="text-right">Approved</Th>
              <Th className="text-right">Outstanding</Th>
              <Th>Status</Th>
              <Th>Bank codes</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((v) =>
              v.masked ? (
                <tr key={v.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                      <Lock className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden />
                      {v.displayName}
                    </span>
                  </Td>
                  <Td colSpan={6}>
                    <StateBadge v={v} />
                  </Td>
                </tr>
              ) : (
                <tr key={v.id}>
                  <Td>
                    <Link href={`${basePath}/${v.id}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                      {v.displayName}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{v.registrationNo}</p>
                  </Td>
                  <Td>{v.programName}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(v.tuition ?? 0)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {formatCurrency(v.confirmed ?? 0)}
                    {v.awaitingCount > 0 && <p className="mt-0.5 text-xs text-[var(--color-info)]">+ {v.awaitingCount} awaiting AOSA</p>}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(v.outstanding ?? 0)}</Td>
                  <Td>
                    <StateBadge v={v} />
                  </Td>
                  <Td>
                    {v.confirmedPayments.length === 0 ? (
                      <span className="text-[var(--color-ink-faint)]">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {v.confirmedPayments.map((p) => (
                          <li key={p.id} className="whitespace-nowrap font-mono text-xs text-[var(--color-ink)]">
                            {p.bankCode}
                            {!p.receivedAt && <span className="ml-2 font-sans text-[var(--color-warning-strong)]">to mark</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
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

export function InstitutionTuitionAccount({ id, institutionId, basePath, staffName }: { id: string; institutionId: string; basePath: string; staffName: string }) {
  const hydrated = useHydrated();
  const accounts = tuitionStore.useItems();
  const account = accounts.find((a) => a.id === id && a.institutionId === institutionId);
  const [notice, setNotice] = useState("");

  const back = (
    <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
      All admitted students
    </Link>
  );

  if (!account) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <>
        {back}
        <EmptyState message="This tuition account doesn't exist, or belongs to another institution." />
      </>
    );
  }

  const v = institutionTuitionView(account);
  if (v.masked) {
    return (
      <>
        {back}
        <EmptyState
          message={`${v.displayName} — awaiting payment. Details appear once AOSA approves the payment.`}
          action={<Link href={basePath} className={ButtonLinkClass("secondary")}>Back to tuition</Link>}
        />
      </>
    );
  }

  const schedule = instalmentCoverage(account);
  const tone = { covered: "success", part: "amber", overdue: "danger", due: "neutral" } as const;
  const label = { covered: "Covered", part: "Part covered", overdue: "Overdue", due: "Not yet due" } as const;

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-bold tracking-tight text-2xl text-[var(--color-ink)]">{v.displayName}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {v.programName}, {v.registrationNo}
          </p>
        </div>
        <StateBadge v={v} />
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {notice}
        </p>
      )}

      <StatStrip
        columns={4}
        stats={[
          { label: "Tuition amount", value: formatCurrency(v.tuition ?? 0) },
          { label: "Approved by AOSA", value: formatCurrency(v.confirmed ?? 0), detail: `${v.confirmedPayments.length} ${v.confirmedPayments.length === 1 ? "payment" : "payments"}` },
          { label: "Awaiting AOSA", value: v.awaitingCount, detail: v.awaitingCount ? "Amounts shown once approved" : "Nothing waiting" },
          { label: "Outstanding", value: formatCurrency(v.outstanding ?? 0) },
        ]}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card padded={false}>
            <CardHeader title="Approved payments" description="Find each bank code on your statement, then mark it received." />
            {v.confirmedPayments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">No approved payments yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {v.confirmedPayments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="font-mono text-sm text-[var(--color-ink)]">{p.bankCode}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Approved by AOSA {formatDate(p.verifiedAt)}</p>
                    </div>
                    <p className="tabular-nums text-[var(--color-ink)]">{formatCurrency(p.amount)}</p>
                    <div className="text-right">
                      {p.receivedAt ? (
                        <>
                          <ToneBadge tone="success">Received</ToneBadge>
                          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                            {formatDate(p.receivedAt)}, {p.receivedBy}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              markReceived(account.id, p.id, staffName, false);
                              setNotice(`${p.bankCode} is no longer marked received.`);
                            }}
                            className="mt-1 text-xs text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]"
                          >
                            Undo
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            markReceived(account.id, p.id, staffName);
                            setNotice(`${p.bankCode} marked received.`);
                          }}
                          className="inline-flex items-center rounded-lg border border-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
                        >
                          Mark received
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {v.awaitingCount > 0 && (
              <p className="border-t border-[var(--color-line)] px-5 py-3 text-sm text-[var(--color-ink-soft)]">
                {v.awaitingCount} more {v.awaitingCount === 1 ? "payment is" : "payments are"} awaiting AOSA approval.
              </p>
            )}
          </Card>

          <Card padded={false}>
            <CardHeader title="Instalment schedule" description="Approved payments are applied to instalments in order." />
            <TableFrame>
              <thead>
                <tr>
                  <Th>Instalment</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Covered</Th>
                  <Th>State</Th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.label}>
                    <Td>{r.label}</Td>
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
        </div>

        <Card padded={false} className="self-start">
          <CardHeader title="Admitted student" />
          <DescriptionList
            items={[
              { label: "Name", value: v.displayName },
              { label: "Registration no.", value: v.registrationNo },
              { label: "Application", value: v.applicationRef },
              { label: "Program", value: v.programName },
              { label: "Admitted", value: formatDate(account.admittedAt) },
              { label: "Offer", value: account.offerAccepted ? "Accepted by student" : "Awaiting student's reply" },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
