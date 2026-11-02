"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatStrip, ToneBadge } from "@/components/admin/ui";
import { Card, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { money, type PayoutRow, type Statement } from "@/components/payouts/PayoutStatement";
import { useT } from "@/lib/i18n/client";

interface Overview {
  currency: string;
  totals: { earned: number; paidOut: number; owed: number };
  institutions: Statement["balance"][];
  recent: PayoutRow[];
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Cheeta administration's payouts desk (/api/admin/payouts): what Cheeta
 * owes each institution from the payments it has collected, a form to
 * record each payout, and the latest payouts. A payout made in error is
 * cancelled with a reason, never deleted.
 */
export function AdminPayouts() {
  const tr = useT();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Statement["balance"] | null>(null);
  const [notice, setNotice] = useState("");

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/payouts", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) return setError(body.error ?? "The payouts could not be loaded.");
        setData(body.data);
        setError(null);
      })
      .catch(() => live && setError("The payouts could not be loaded. Check your connection."));
    return () => {
      live = false;
    };
  }, [version]);

  async function cancel(p: PayoutRow) {
    const reason = window.prompt(tr("Why is the payout of {amount} to {institution} cancelled? It stays on record and the amount goes back on what is owed.", { amount: money(p.amount), institution: p.institutionName }));
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/payouts/${encodeURIComponent(p.id)}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "The payout could not be cancelled.");
    setNotice(tr("Payout cancelled."));
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title={tr("Payouts")}
        description={tr("Applicants pay everything to Cheeta. Each institution is owed the application fee of every payment Cheeta approved and every tuition payment Cheeta verified; the web fee stays with Cheeta. Record each payout here when you pay an institution.")}
      />
      {error && <FormError>{tr(error)}</FormError>}
      {notice && (
        <p role="status" className="text-sm text-[var(--color-success-strong)]">
          {notice}
        </p>
      )}
      {!data ? (
        !error && <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>
      ) : (
        <>
          <StatStrip
            columns={3}
            stats={[
              { label: tr("Owed to institutions"), value: money(data.totals.owed) },
              { label: tr("Earned by institutions"), value: money(data.totals.earned), detail: tr("Approved fees and verified tuition") },
              { label: tr("Paid out"), value: money(data.totals.paidOut) },
            ]}
          />

          {paying && (
            <RecordPayout
              // A fresh form for each institution: nothing typed for one carries over to another.
              key={paying.institutionId}
              balance={paying}
              onClose={() => setPaying(null)}
              onDone={(msg) => {
                setPaying(null);
                setNotice(msg);
                void load();
              }}
            />
          )}

          {data.institutions.length === 0 ? (
            <EmptyState message={tr("No institutions yet.")} />
          ) : (
            <TableFrame>
              <thead>
                <tr>
                  <Th>{tr("Institution")}</Th>
                  <Th className="text-right">{tr("Application fees")}</Th>
                  <Th className="text-right">{tr("Tuition")}</Th>
                  <Th className="text-right">{tr("Paid out")}</Th>
                  <Th className="text-right">{tr("Owed now")}</Th>
                  <Th>{tr("Last payout")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.institutions.map((b) => (
                  <tr key={b.institutionId} className="border-t border-[var(--color-line)]">
                    <Td className="font-medium text-[var(--color-ink)]">{b.institutionName}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{money(b.applicationFees)}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{money(b.tuition)}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{money(b.paidOut)}</Td>
                    <Td className={`whitespace-nowrap text-right font-semibold tabular-nums ${b.owed > 0 ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`}>{money(b.owed)}</Td>
                    <Td>{b.lastPaidOn ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <Link href={`/admin/payouts/${encodeURIComponent(b.institutionId)}`} aria-label={tr("Statement for {institution}", { institution: b.institutionName })} className="mr-3 text-sm underline underline-offset-4">
                        {tr("Statement")}
                      </Link>
                      {b.owed > 0 && (
                        <button type="button" aria-label={tr("Record payout to {institution}", { institution: b.institutionName })} onClick={() => {
                            setPaying(b);
                            setNotice("");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }} className="text-sm font-medium text-[var(--color-brand-strong)] underline underline-offset-4">
                          {tr("Record payout")}
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          )}

          <section className="space-y-3">
            <p className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{tr("Latest payouts")}</p>
            {data.recent.length === 0 ? (
              <EmptyState message={tr("No payouts recorded yet.")} />
            ) : (
              <TableFrame>
                <thead>
                  <tr>
                    <Th>{tr("Paid on")}</Th>
                    <Th>{tr("Institution")}</Th>
                    <Th className="text-right">{tr("Amount")}</Th>
                    <Th>{tr("Reference")}</Th>
                    <Th>{tr("Recorded by")}</Th>
                    <Th>{tr("Status")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--color-line)]">
                      <Td>{p.paidOn}</Td>
                      <Td>{p.institutionName}</Td>
                      <Td className={`whitespace-nowrap text-right tabular-nums ${p.cancelled ? "text-[var(--color-ink-faint)] line-through" : ""}`}>{money(p.amount)}</Td>
                      <Td className="font-mono text-xs">{p.reference}</Td>
                      <Td>{p.recordedBy ?? "—"}</Td>
                      <Td>{p.cancelled ? <ToneBadge tone="danger">{tr("Cancelled")}</ToneBadge> : <ToneBadge tone="success">{tr("Paid")}</ToneBadge>}</Td>
                      <Td>
                        {!p.cancelled && (
                          <button type="button" onClick={() => void cancel(p)} className="text-sm text-[var(--color-danger)] underline underline-offset-4">
                            {tr("Cancel")}
                          </button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** The form for one payout to one institution, with its verified payout accounts to choose from. */
function RecordPayout({ balance, onClose, onDone }: { balance: Statement["balance"]; onClose: () => void; onDone: (notice: string) => void }) {
  const tr = useT();
  const [accounts, setAccounts] = useState<Statement["payoutAccounts"] | null>(null);
  const [form, setForm] = useState({ amount: String(balance.owed), paidOn: today(), reference: "", payoutAccountId: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/payouts/institutions/${encodeURIComponent(balance.institutionId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        const list: Statement["payoutAccounts"] = b?.data?.payoutAccounts ?? [];
        setAccounts(list);
        if (list.length === 1) setForm((f) => ({ ...f, payoutAccountId: list[0].id }));
      })
      .catch(() => setAccounts([]));
  }, [balance.institutionId]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId: balance.institutionId, amount: Number(form.amount.replace(/[\s,]/g, "")), paidOn: form.paidOn, reference: form.reference, payoutAccountId: form.payoutAccountId || null, note: form.note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.fieldErrors ?? {});
        setFormError(body.fieldErrors ? null : (body.error ?? "The payout could not be recorded."));
      } else onDone(tr("Payout of {amount} to {institution} recorded. The institution has been notified.", { amount: money(Number(form.amount.replace(/[\s,]/g, ""))), institution: balance.institutionName }));
    } catch {
      setFormError("The payout could not be recorded. Check your connection and try again.");
    }
    setSaving(false);
  }

  return (
    <Card>
      <p className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{tr("Record a payout to {institution}", { institution: balance.institutionName })}</p>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{tr("Cheeta owes {amount}. Record the payout once the money has been sent.", { amount: money(balance.owed) })}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={tr("Amount (XAF)")} required error={errors.amount}>
          <TextInput inputMode="numeric" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
        </Field>
        <Field label={tr("Paid on")} required error={errors.paidOn}>
          <TextInput type="date" max={today()} value={form.paidOn} onChange={(e) => set("paidOn", e.target.value)} />
        </Field>
        <Field label={tr("Paid into")} error={errors.payoutAccountId} hint={accounts && accounts.length === 0 ? tr("This institution has no verified payout account yet.") : undefined}>
          <SelectInput value={form.payoutAccountId} onChange={(e) => set("payoutAccountId", e.target.value)} disabled={!accounts?.length}>
            <option value="">{accounts === null ? tr("Loading…") : tr("Not specified")}</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} · {a.provider} · {a.accountNumber}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={tr("Transaction reference")} required error={errors.reference}>
          <TextInput value={form.reference} onChange={(e) => set("reference", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={tr("Note")} error={errors.note}>
            <TextArea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>
      </div>
      {formError && (
        <div className="mt-3">
          <FormError>{tr(formError)}</FormError>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <PrimaryButton disabled={saving} onClick={() => void save()}>
          {saving ? tr("Saving…") : tr("Record payout")}
        </PrimaryButton>
        <SecondaryButton onClick={onClose}>{tr("Cancel")}</SecondaryButton>
      </div>
    </Card>
  );
}
