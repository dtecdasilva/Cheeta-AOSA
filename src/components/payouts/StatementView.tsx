"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeading } from "@/components/ui";
import { FormError } from "@/components/Form";
import { money, PayoutStatement, type PayoutRow, type Statement } from "@/components/payouts/PayoutStatement";
import { useT } from "@/lib/i18n/client";

/**
 * Loads one institution's payout statement from `url` and shows it. Cheeta
 * administration passes `admin` to get a back link and the cancel button.
 */
export function StatementView({ url, admin = false }: { url: string; admin?: boolean }) {
  const tr = useT();
  const [s, setS] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let live = true;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) return setError(body.error ?? "The statement could not be loaded.");
        setS(body.data);
        setError(null);
      })
      .catch(() => live && setError("The statement could not be loaded. Check your connection."));
    return () => {
      live = false;
    };
  }, [url, version]);

  async function cancel(p: PayoutRow) {
    const reason = window.prompt(tr("Why is the payout of {amount} to {institution} cancelled? It stays on record and the amount goes back on what is owed.", { amount: money(p.amount), institution: p.institutionName }));
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/payouts/${encodeURIComponent(p.id)}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "The payout could not be cancelled.");
    void load();
  }

  return (
    <div className="space-y-6">
      {admin && (
        <Link href="/admin/payouts" className="text-sm underline underline-offset-4">
          ← {tr("All payouts")}
        </Link>
      )}
      <PageHeading
        title={admin && s ? tr("Payouts to {institution}", { institution: s.balance.institutionName }) : tr("Payouts")}
        description={
          admin
            ? tr("What Cheeta owes this institution, how that figure is made up, and every payout recorded.")
            : tr("Applicants pay Cheeta AOSA. Cheeta pays you the application fee of every payment it approves and every tuition payment it verifies, into your verified payout accounts. This is what Cheeta owes you and what it has paid.")
        }
      />
      {error && <FormError>{tr(error)}</FormError>}
      {!s ? !error && <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p> : <PayoutStatement s={s} onCancel={admin ? (p) => void cancel(p) : undefined} />}
    </div>
  );
}
