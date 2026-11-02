"use client";

import { StatStrip, ToneBadge } from "@/components/admin/ui";
import { EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { formatAmount } from "@/lib/currency/data";
import { useT } from "@/lib/i18n/client";

export interface PayoutRow {
  id: string;
  institutionId: string;
  institutionName: string;
  amount: number;
  currency: string;
  paidOn: string;
  reference: string;
  note: string;
  payoutAccount: { label: string; provider: string; accountNumber: string } | null;
  recordedBy: string | null;
  recordedAt: string;
  cancelled: { at: string; reason: string } | null;
}

export interface Statement {
  currency: string;
  balance: { institutionId: string; institutionName: string; applicationFees: number; tuition: number; earned: number; paidOut: number; owed: number; lastPaidOn: string | null };
  earned: { id: string; kind: "Application fee" | "Tuition"; at: string | null; bankCode: string; reference: string; student: string; amount: number }[];
  payouts: PayoutRow[];
  payoutAccounts: { id: string; type: string; label: string; provider: string; accountName: string; accountNumber: string }[];
}

export const money = (n: number) => formatAmount(n, "XAF");
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

/**
 * What Cheeta owes one institution and how that figure is made up: every
 * payment that counts towards it (approved application fees, verified
 * tuition) and every payout. Shown to Cheeta administration and to the
 * institution itself.
 */
export function PayoutStatement({ s, onCancel }: { s: Statement; onCancel?: (p: PayoutRow) => void }) {
  const tr = useT();
  const b = s.balance;
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: tr("Owed now"), value: money(b.owed), detail: b.lastPaidOn ? tr("Last payout {date}", { date: b.lastPaidOn }) : tr("No payout yet") },
          { label: tr("Application fees"), value: money(b.applicationFees), detail: tr("Approved by Cheeta") },
          { label: tr("Tuition"), value: money(b.tuition), detail: tr("Verified by Cheeta") },
          { label: tr("Paid out"), value: money(b.paidOut) },
        ]}
      />

      <section className="space-y-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{tr("Payouts")}</p>
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{tr("Money Cheeta has sent. A cancelled payout stays listed and no longer counts.")}</p>
        </div>
        {s.payouts.length === 0 ? (
          <EmptyState message={tr("No payouts yet.")} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>{tr("Paid on")}</Th>
                <Th>{tr("Amount")}</Th>
                <Th>{tr("Reference")}</Th>
                <Th>{tr("Paid into")}</Th>
                <Th>{tr("Status")}</Th>
                {onCancel && <Th />}
              </tr>
            </thead>
            <tbody>
              {s.payouts.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-line)] align-top">
                  <Td>{p.paidOn}</Td>
                  <Td className={`whitespace-nowrap tabular-nums ${p.cancelled ? "text-[var(--color-ink-faint)] line-through" : ""}`}>{money(p.amount)}</Td>
                  <Td>
                    <span className="font-mono text-xs">{p.reference}</span>
                    {p.note && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{p.note}</p>}
                  </Td>
                  <Td>{p.payoutAccount ? `${p.payoutAccount.label} · ${p.payoutAccount.accountNumber}` : "—"}</Td>
                  <Td>
                    {p.cancelled ? (
                      <>
                        <ToneBadge tone="danger">{tr("Cancelled")}</ToneBadge>
                        <p className="mt-1 max-w-56 text-xs text-[var(--color-ink-soft)]">{p.cancelled.reason}</p>
                      </>
                    ) : (
                      <ToneBadge tone="success">{tr("Paid")}</ToneBadge>
                    )}
                  </Td>
                  {onCancel && (
                    <Td>
                      {!p.cancelled && (
                        <button type="button" onClick={() => onCancel(p)} className="text-sm text-[var(--color-danger)] underline underline-offset-4">
                          {tr("Cancel")}
                        </button>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{tr("What counts towards it")}</p>
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{tr("The application fee of every payment Cheeta approved (the web fee is Cheeta's) and every tuition payment Cheeta verified.")}</p>
        </div>
        {s.earned.length === 0 ? (
          <EmptyState message={tr("No approved payments yet.")} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>{tr("Approved")}</Th>
                <Th>{tr("Kind")}</Th>
                <Th>{tr("Student")}</Th>
                <Th>{tr("Application")}</Th>
                <Th>{tr("Bank code")}</Th>
                <Th className="text-right">{tr("Amount")}</Th>
              </tr>
            </thead>
            <tbody>
              {s.earned.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-line)]">
                  <Td>{day(e.at)}</Td>
                  <Td>{tr(e.kind)}</Td>
                  <Td>{e.student}</Td>
                  <Td className="font-mono text-xs">{e.reference}</Td>
                  <Td className="font-mono text-xs">{e.bankCode}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{money(e.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </section>
    </div>
  );
}
