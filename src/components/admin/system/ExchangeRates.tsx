"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Card, EmptyState, PageHeading, SectionHeading, TableFrame, Td, Th } from "@/components/ui";
import { Field, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { StatStrip, SubNav, ToneBadge } from "@/components/admin/ui";
import { SYSTEM_NAV } from "./ReferenceManagers";
import { BASE_CURRENCY, currencyStore, rateStore, type AdminCurrency, type AdminExchangeRate, type RateRecord } from "@/lib/admin/reference";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

const DAY = 86_400_000;
const STALE_DAYS = 45;

function format(amount: number, c: AdminCurrency | undefined, code: string) {
  if (!Number.isFinite(amount)) return "—";
  const digits = c?.decimalDigits ?? 2;
  const n = amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (!c) return `${n} ${code}`;
  return c.symbolPosition === "prefix" ? `${c.symbol}${n}` : `${n} ${c.symbol}`;
}

const API = "/api/admin/exchange-rates";

/**
 * Rates are stored in the database and are a record: a rate is never
 * edited or deleted. "Update" adds a new rate that takes over from the
 * one before it; a rate entered by mistake can be withdrawn, which leaves
 * it in the history and hands back to the previous one.
 */
export function ExchangeRates() {
  const tr = useT();
  const rates = rateStore.useItems();
  const currencies = currencyStore.useItems();
  const [history, setHistory] = useState<RateRecord[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: "no-store" });
      if (res.ok) setHistory(((await res.json()) as { history: RateRecord[] }).history);
    } catch {
      // The table of current rates still shows; the history just stays as it was.
    }
  }, []);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  /** After any change: read the current rates and the history again. */
  const refresh = useCallback(() => {
    rateStore.reset();
    void loadHistory();
  }, [loadHistory]);

  async function setStatus(rate: RateRecord, status: "ACTIVE" | "INACTIVE") {
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${API}/${encodeURIComponent(rate.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.fieldErrors?.status ?? body.error ?? tr("That could not be saved."));
      setNotice(status === "INACTIVE" ? tr("{fromCurrency} rate of {rate} withdrawn. It stays in the history.", { fromCurrency: rate.fromCurrency, rate: rate.rate }) : tr("{fromCurrency} rate of {rate} restored.", { fromCurrency: rate.fromCurrency, rate: rate.rate }));
      refresh();
    } catch {
      setError(tr("That could not be saved. Check your connection and try again."));
    }
  }

  const currency = (code: string) => currencies.find((c) => c.code === code);
  const rateFor = (code: string) => (code === BASE_CURRENCY ? 1 : rates.find((r) => r.code === code)?.xafPerUnit ?? 0);
  // Every currency on the list has a row here, whether or not a rate has been set for it yet.
  const codes = [...new Set([...currencies.filter((c) => c.status === "ACTIVE").map((c) => c.code), ...rates.map((r) => r.code)])].filter((c) => c !== BASE_CURRENCY).sort();
  const rows: AdminExchangeRate[] = codes.map((code) => rates.find((r) => r.code === code) ?? { id: code, code, xafPerUnit: 0, source: "Not set", asOf: "", updatedBy: "" });
  const stale = rows.filter((r) => r.xafPerUnit <= 0 || !r.asOf || now - new Date(r.asOf).getTime() > STALE_DAYS * DAY);
  const latest = rows.reduce((max, r) => (r.asOf > max ? r.asOf : max), "");

  return (
    <>
      <PageHeading
        title={tr("Exchange rates")}
        description={tr("What one unit of each currency is worth in {BASE_CURRENCY}. Applicants see fees converted at these rates; what they owe is always the {BASE_CURRENCY2} amount.", { BASE_CURRENCY, BASE_CURRENCY2: BASE_CURRENCY })}
      />
      <SubNav items={SYSTEM_NAV} current="/admin/config/exchange-rates" />

      <div className="mb-6">
        <StatStrip
          stats={[
            { label: tr("Rates"), value: rows.length, detail: tr("Against {BASE_CURRENCY}", { BASE_CURRENCY }) },
            { label: tr("Last updated"), value: latest ? formatDate(latest) : "—" },
            { label: tr("Need attention"), value: stale.length, detail: tr("Missing or older than {STALE_DAYS} days", { STALE_DAYS }) },
            { label: tr("Currencies"), value: currencies.length, href: "/admin/config/currencies" },
          ]}
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-strong)]">
          {tr(error)}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {tr(notice)}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <EmptyState message={tr("No rates yet. Add a currency first; it gets a rate to fill in.")} />
          ) : (
            <TableFrame>
              <thead>
                <tr>
                  <Th>{tr("Currency")}</Th>
                  <Th className="text-right">{tr("{BASE_CURRENCY} per unit", { BASE_CURRENCY })}</Th>
                  <Th className="text-right">{tr("Per 10,000 {BASE_CURRENCY}", { BASE_CURRENCY })}</Th>
                  <Th>{tr("Source")}</Th>
                  <Th>{tr("As of")}</Th>
                  <Th>
                    <span className="sr-only">{tr("Actions")}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  editing === r.code ? (
                    <RateEditRow
                      key={r.code}
                      rate={r}
                      currency={currency(r.code)}
                      onCancel={() => setEditing(null)}
                      onSaved={(msg) => {
                        setEditing(null);
                        setError("");
                        setNotice(msg);
                        refresh();
                      }}
                    />
                  ) : (
                    <tr key={r.code} className="align-top">
                      <Td>
                        <p className="font-medium text-[var(--color-ink)]">{r.code}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{currency(r.code)?.name ?? tr("Not on the currency list")}</p>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.xafPerUnit > 0 ? r.xafPerUnit.toLocaleString("en-GB", { maximumFractionDigits: 4 }) : <span className="text-[var(--color-danger)]">{tr("Not set")}</span>}
                      </Td>
                      <Td className="text-right tabular-nums text-[var(--color-ink-soft)]">{r.xafPerUnit > 0 ? format(10000 / r.xafPerUnit, currency(r.code), r.code) : "—"}</Td>
                      <Td className="text-[var(--color-ink-soft)]">{r.source}</Td>
                      <Td>
                        <p className="whitespace-nowrap text-[var(--color-ink)]">{r.asOf ? formatDate(r.asOf) : "—"}</p>
                        {stale.includes(r) && (
                          <span className="mt-1 inline-block">
                            <ToneBadge tone="amber">{r.xafPerUnit > 0 ? tr("Out of date") : tr("Missing")}</ToneBadge>
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(r.code);
                            setNotice("");
                          }}
                          className="text-sm text-[var(--color-ink)] underline underline-offset-4"
                        >
                          {tr("Update")}
                        </button>
                      </Td>
                    </tr>
                  )
                )}
              </tbody>
            </TableFrame>
          )}
        </div>

        <Converter currencies={currencies} rateFor={rateFor} format={(n, code) => format(n, currency(code), code)} />
      </div>

      <section className="mt-10">
        <SectionHeading title={tr("Rate history")} description={tr("Every rate ever recorded, newest first. Rates are never edited or deleted; one entered by mistake can be withdrawn.")} />
        {history.length === 0 ? (
          <EmptyState message={tr("No rate has been recorded yet.")} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>{tr("Pair")}</Th>
                <Th className="text-right">{tr("Rate")}</Th>
                <Th>{tr("Effective from")}</Th>
                <Th>{tr("Until")}</Th>
                <Th>{tr("Source")}</Th>
                <Th>{tr("Status")}</Th>
                <Th>{tr("By")}</Th>
                <Th>
                  <span className="sr-only">{tr("Actions")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className={h.status === "INACTIVE" ? "text-[var(--color-ink-faint)]" : ""}>
                  <Td className="whitespace-nowrap font-medium text-[var(--color-ink)]">
                    {h.fromCurrency} → {h.toCurrency}
                  </Td>
                  <Td className="text-right tabular-nums">{h.rate.toLocaleString("en-GB", { maximumFractionDigits: 6 })}</Td>
                  <Td className="whitespace-nowrap">{formatDateTime(h.effectiveFrom)}</Td>
                  <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">{h.status === "INACTIVE" ? "—" : h.appliesUntil ? formatDateTime(h.appliesUntil) : tr("Open-ended")}</Td>
                  <Td className="text-[var(--color-ink-soft)]">{h.source}</Td>
                  <Td>
                    {h.status === "INACTIVE" ? (
                      <ToneBadge tone="neutral">{tr("Withdrawn")}</ToneBadge>
                    ) : h.current ? (
                      <ToneBadge tone="success">{tr("In force")}</ToneBadge>
                    ) : new Date(h.effectiveFrom).getTime() > now ? (
                      <ToneBadge tone="info">{tr("Scheduled")}</ToneBadge>
                    ) : (
                      <ToneBadge tone="neutral">{tr("Past")}</ToneBadge>
                    )}
                  </Td>
                  <Td className="text-[var(--color-ink-soft)]">{h.createdBy ?? "—"}</Td>
                  <Td className="text-right">
                    <button type="button" onClick={() => setStatus(h, h.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                      {h.status === "ACTIVE" ? tr("Withdraw") : tr("Restore")}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </section>
    </>
  );
}

function RateEditRow({ rate, currency, onCancel, onSaved }: { rate: AdminExchangeRate; currency?: AdminCurrency; onCancel: () => void; onSaved: (msg: string) => void }) {
  const tr = useT();
  const [value, setValue] = useState(rate.xafPerUnit > 0 ? String(rate.xafPerUnit) : "");
  const [source, setSource] = useState(rate.source === "Not set" ? tr("BEAC reference rate") : rate.source);
  // Empty means "from now". A later date schedules the rate; an earlier one back-dates it.
  const [from, setFrom] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(value);
    if (!value || Number.isNaN(n) || n <= 0) {
      setError(tr("Enter a rate above 0."));
      return;
    }
    if (!source.trim()) {
      setError(tr("Say where the rate comes from."));
      return;
    }
    if (rate.xafPerUnit > 0 && Math.abs(n - rate.xafPerUnit) / rate.xafPerUnit > 0.25 && !window.confirm(tr("That's more than a 25% change from {xafPerUnit}. Save it anyway?", { xafPerUnit: rate.xafPerUnit }))) return;
    // A new rate is a new record; the one it takes over from is left exactly as it was.
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromCurrency: rate.code, toCurrency: BASE_CURRENCY, rate: n, source: source.trim(), ...(from ? { effectiveFrom: new Date(from).toISOString() } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(Object.values((body.fieldErrors ?? {}) as Record<string, string>)[0] ?? body.error ?? tr("The rate could not be saved."));
        return;
      }
      const when = from && new Date(from).getTime() > Date.now() ? ` from ${formatDateTime(new Date(from).toISOString())}` : "";
      onSaved(tr("{code} rate set to {value} {BASE_CURRENCY}{when}.", { code: rate.code, value: n.toLocaleString("en-GB", { maximumFractionDigits: 4 }), BASE_CURRENCY, when }));
    } catch {
      setError(tr("The rate could not be saved. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-[var(--color-paper)] align-top">
      <Td>
        <p className="font-medium text-[var(--color-ink)]">{rate.code}</p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(currency?.name)}</p>
      </Td>
      <Td colSpan={4}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("{BASE_CURRENCY} for 1 {code}", { BASE_CURRENCY, code: rate.code })} error={error}>
            <TextInput
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={value}
              autoFocus
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") onCancel();
              }}
            />
          </Field>
          <Field label={tr("Source")}>
            <TextInput value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <Field label={tr("Effective from")} hint={tr("Leave empty to start now.")}>
            <TextInput type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </div>
      </Td>
      <Td>
        <div className="flex flex-col gap-2">
          <PrimaryButton type="button" onClick={save} disabled={saving}>
            {saving ? tr("Saving…") : tr("Save")}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onCancel}>
            {tr("Cancel")}
          </SecondaryButton>
        </div>
      </Td>
    </tr>
  );
}

function Converter({ currencies, rateFor, format }: { currencies: AdminCurrency[]; rateFor: (code: string) => number; format: (n: number, code: string) => string }) {
  const tr = useT();
  const [amount, setAmount] = useState("25000");
  const [from, setFrom] = useState(BASE_CURRENCY);
  const [to, setTo] = useState("EUR");
  const n = Number(amount);
  const fromRate = rateFor(from);
  const toRate = rateFor(to);
  const result = fromRate > 0 && toRate > 0 && amount !== "" && !Number.isNaN(n) ? (n * fromRate) / toRate : Number.NaN;

  return (
    <Card className="self-start">
      <p className="font-semibold text-base text-[var(--color-ink)]">{tr("Converter")}</p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr("Check a rate the way applicants will see it.")}</p>
      <div className="mt-4 space-y-3">
        <Field label={tr("Amount")}>
          <TextInput type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label={tr("From")}>
            <SelectInput value={from} onChange={(e) => setFrom(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </SelectInput>
          </Field>
          <button
            type="button"
            aria-label={tr("Swap currencies")}
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="mb-0.5 rounded-lg border border-[var(--color-line-strong)] p-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <ArrowRightLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <Field label={tr("To")}>
            <SelectInput value={to} onChange={(e) => setTo(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>
      <div className="mt-4 border-t border-[var(--color-line)] pt-4" aria-live="polite">
        <p className="font-bold tracking-tight text-2xl tabular-nums text-[var(--color-ink)]">{format(result, to)}</p>
        <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
          {fromRate > 0 && toRate > 0 ? `1 ${from} = ${(fromRate / toRate).toLocaleString("en-GB", { maximumFractionDigits: 6 })} ${to}` : tr("No rate set for one of these currencies.")}
        </p>
      </div>
    </Card>
  );
}
