"use client";

import { useEffect, useState } from "react";
import { SectionHeading, TableFrame, Td, Th } from "@/components/ui";
import { ActiveBadge } from "@/components/admin/ui";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface Row {
  id: string;
  name: string;
  /** The institution's own web fee, or null when it uses the platform's. */
  webFee: number | null;
  status: "ACTIVE" | "INACTIVE";
}

/**
 * The web fee each institution's applicants pay: the platform web fee,
 * unless the institution has been given one of its own. Read from and
 * saved to the database (/api/admin/institutions).
 */
export function InstitutionWebFees({ platformFee }: { platformFee: number }) {
  const tr = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/institutions?pageSize=200", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (res.ok) setRows([...(body.data as Row[])].sort((a, b) => a.name.localeCompare(b.name)));
        else setError(body.error ?? tr("Could not load the institutions."));
      })
      .catch(() => !cancelled && setError(tr("Could not load the institutions. Check your connection.")));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(id: string, webFee: number | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/institutions/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webFee }) });
      const body = await res.json();
      if (!res.ok) setError(body.fieldErrors?.webFee ?? body.error ?? tr("Could not save the web fee."));
      else {
        setRows((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, webFee: body.data.webFee } : r)));
        setEditing(null);
      }
    } catch {
      setError(tr("Could not save the web fee. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  }

  function submit(id: string) {
    const n = Number(value);
    if (value.trim() === "" || !Number.isInteger(n) || n < 0) setError(tr("Enter the web fee as a whole number of francs, 0 or more."));
    else void save(id, n);
  }

  const own = (rows ?? []).filter((r) => r.webFee !== null).length;

  return (
    <section className="mt-10">
      <SectionHeading
        title={tr("Web fee by institution")}
        description={
          rows
            ? `The platform web fee is ${formatCurrency(platformFee)}. ${own === 0 ? tr("Every institution uses it.") : tr("{own} of {count} institutions have a web fee of their own instead.", { own, count: rows.length })}`
            : tr("What applicants pay the platform on top of each institution's application fee.")
        }
      />
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-strong)]">
          {tr(error)}
        </p>
      )}
      <TableFrame>
        <thead>
          <tr>
            <Th>{tr("Institution")}</Th>
            <Th className="text-right">{tr("Web fee")}</Th>
            <Th>{tr("Status")}</Th>
            <Th>
              <span className="sr-only">{tr("Actions")}</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {!rows && !error && (
            <tr>
              <Td className="text-[var(--color-ink-soft)]">{tr("Loading…")}</Td>
            </tr>
          )}
          {(rows ?? []).map((r) => (
            <tr key={r.id}>
              <Td className="text-[var(--color-ink)]">{r.name}</Td>
              <Td className="text-right tabular-nums">
                {r.webFee === null ? (
                  <>
                    {formatCurrency(platformFee)} <span className="ml-1 text-xs text-[var(--color-ink-faint)]">{tr("platform fee")}</span>
                  </>
                ) : (
                  <>
                    {formatCurrency(r.webFee)} <span className="ml-1 text-xs text-[var(--color-ink-faint)]">{tr("own fee")}</span>
                  </>
                )}
              </Td>
              <Td>
                <ActiveBadge active={r.status === "ACTIVE"} />
              </Td>
              <Td className="text-right">
                {editing === r.id ? (
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      aria-label={tr("Web fee for {name}, in XAF", { name: tr(r.name) })}
                      className="w-28 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2 py-1 text-right text-sm"
                    />
                    <button type="button" disabled={busy} onClick={() => submit(r.id)} className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
                      {tr("Save")}
                    </button>
                    {r.webFee !== null && (
                      <button type="button" disabled={busy} onClick={() => void save(r.id, null)} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                        {tr("Use platform fee")}
                      </button>
                    )}
                    <button type="button" onClick={() => setEditing(null)} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
                      {tr("Cancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(r.id);
                      setValue(String(r.webFee ?? platformFee));
                      setError(null);
                    }}
                    className="text-sm text-[var(--color-ink)] underline underline-offset-4"
                  >
                    {tr("Change")}
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableFrame>
    </section>
  );
}
