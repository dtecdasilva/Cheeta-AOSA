"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionHeading, TableFrame, Td, Th } from "@/components/ui";
import { PrimaryButton, SelectInput } from "@/components/Form";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Subscription {
  id: string;
  institutionId: string;
  institutionName: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "CANCELLED" | "EXPIRED";
  subscriptionFee: number;
  perNameFee: number;
  paymentReference: string;
  note: string;
  decisionNote: string;
  requestedAt: string;
  startsAt: string | null;
  endsAt: string | null;
  charges: { names: number; amount: number; unpaid: number };
}

const STATUS: Record<Subscription["status"], { label: string; cls: string }> = {
  PENDING: { label: "Awaiting approval", cls: "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]" },
  ACTIVE: { label: "Active", cls: "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]" },
  REJECTED: { label: "Rejected", cls: "bg-[var(--color-danger-soft)] text-[var(--color-danger-strong)]" },
  CANCELLED: { label: "Cancelled", cls: "bg-[var(--color-line)]/60 text-[var(--color-ink-soft)]" },
  EXPIRED: { label: "Expired", cls: "bg-[var(--color-line)]/60 text-[var(--color-ink-soft)]" },
};

const link = "text-sm text-[var(--color-ink)] underline underline-offset-4 disabled:opacity-50";

/**
 * Deliberation subscriptions, for the Cheeta administrator: approve or
 * reject requests from institutions, start one directly, and record the
 * per-name charges as paid. Read from and saved to the database
 * (/api/admin/deliberation/subscriptions).
 */
export function DeliberationSubscriptions() {
  const [rows, setRows] = useState<Subscription[] | null>(null);
  const [feesSet, setFeesSet] = useState(true);
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [grantTo, setGrantTo] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/deliberation/subscriptions", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) return setError(body.error ?? "Could not load the subscriptions.");
      setRows(body.data);
      setFeesSet(!!body.fees?.set);
    } catch {
      setError("Could not load the subscriptions. Check your connection.");
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/admin/institutions?pageSize=200&status=ACTIVE", { cache: "no-store" })
      .then(async (res) => (res.ok ? setInstitutions([...((await res.json()).data as { id: string; name: string }[])].sort((a, b) => a.name.localeCompare(b.name))) : undefined))
      .catch(() => undefined);
  }, [load]);

  async function post(url: string, body: unknown, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(Object.values((data.fieldErrors ?? {}) as Record<string, string>)[0] ?? data.error ?? "That could not be saved.");
      else {
        setNotice(done);
        setRejecting(null);
        setReason("");
        setGrantTo("");
        await load();
      }
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const base = "/api/admin/deliberation/subscriptions";

  return (
    <section className="mt-10">
      <SectionHeading
        title="Deliberation subscriptions"
        description="Institutions that have asked to deliberate, or are subscribed. Approving a request starts its 12 months; each applicant name on the institution's Deliberation List is then charged at the per-name fee."
      />
      {!feesSet && (
        <p className="mb-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          The deliberation fees haven&apos;t both been set yet, so institutions can&apos;t subscribe. Set them under Deliberation fees above and save.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-strong)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-3 rounded-lg bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {notice}
        </p>
      )}

      <TableFrame>
        <thead>
          <tr>
            <Th>Institution</Th>
            <Th>Status</Th>
            <Th className="text-right">Annual fee</Th>
            <Th className="text-right">Per name</Th>
            <Th>Period</Th>
            <Th className="text-right">Names charged</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows && rows.length === 0 && (
            <tr>
              <Td className="text-[var(--color-ink-soft)]">No institution has asked to deliberate yet.</Td>
            </tr>
          )}
          {(rows ?? []).map((s) => (
            <tr key={s.id}>
              <Td>
                <span className="text-[var(--color-ink)]">{s.institutionName}</span>
                {s.paymentReference && <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">Payment reference: {s.paymentReference}</span>}
                {s.note && <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">{s.note}</span>}
              </Td>
              <Td>
                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
              </Td>
              <Td className="text-right tabular-nums">{formatCurrency(s.subscriptionFee)}</Td>
              <Td className="text-right tabular-nums">{formatCurrency(s.perNameFee)}</Td>
              <Td className="whitespace-nowrap">{s.startsAt && s.endsAt ? `${formatDate(s.startsAt)} – ${formatDate(s.endsAt)}` : `Requested ${formatDate(s.requestedAt)}`}</Td>
              <Td className="text-right tabular-nums">
                {s.charges.names} <span className="text-[var(--color-ink-faint)]">· {formatCurrency(s.charges.amount)}</span>
                {s.charges.unpaid > 0 && <span className="mt-0.5 block text-xs text-[var(--color-warning-strong)]">{formatCurrency(s.charges.unpaid)} unpaid</span>}
              </Td>
              <Td className="text-right">
                {s.status === "PENDING" &&
                  (rejecting === s.id ? (
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason"
                        aria-label="Reason for rejecting"
                        className="w-40 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2 py-1 text-sm"
                      />
                      <button type="button" disabled={busy} className={link} onClick={() => post(`${base}/${s.id}/decision`, { decision: "reject", note: reason }, "Request rejected.")}>
                        Reject
                      </button>
                      <button type="button" className={link} onClick={() => setRejecting(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center justify-end gap-3">
                      <button type="button" disabled={busy} className={`${link} font-medium`} onClick={() => post(`${base}/${s.id}/decision`, { decision: "approve" }, `${s.institutionName} can now deliberate.`)}>
                        Approve
                      </button>
                      <button type="button" className="text-sm text-[var(--color-danger)] underline underline-offset-4" onClick={() => setRejecting(s.id)}>
                        Reject
                      </button>
                    </span>
                  ))}
                {s.status !== "PENDING" && s.charges.unpaid > 0 && (
                  <button type="button" disabled={busy} className={link} onClick={() => post(`${base}/${s.id}/settle`, null, "Per-name charges recorded as paid.")}>
                    Record charges as paid
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableFrame>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Start a subscription for an institution that paid outside the platform</span>
          <SelectInput value={grantTo} onChange={(e) => setGrantTo(e.target.value)}>
            <option value="">Choose an institution…</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </SelectInput>
        </label>
        <PrimaryButton type="button" disabled={busy || !grantTo || !feesSet} onClick={() => post(base, { institutionId: grantTo }, "Subscription started.")}>
          Start subscription
        </PrimaryButton>
      </div>
    </section>
  );
}
