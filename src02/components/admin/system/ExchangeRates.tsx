"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Card, EmptyState, PageHeading, SectionHeading, TableFrame, Td, Th } from "@/components/ui";
import { Field, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { StatStrip, SubNav, ToneBadge } from "@/components/admin/ui";
import { SYSTEM_NAV } from "./ReferenceManagers";
import { BASE_CURRENCY, currencyStore, rateHistoryStore, rateStore, type AdminCurrency, type AdminExchangeRate } from "@/lib/admin/reference";
import { newId } from "@/lib/admin/store";
import { formatDate, formatDateTime } from "@/lib/utils";

const DAY = 86_400_000;
const STALE_DAYS = 45;

function format(amount: number, c: AdminCurrency | undefined, code: string) {
  if (!Number.isFinite(amount)) return "—";
  const digits = c?.decimalDigits ?? 2;
  const n = amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (!c) return `${n} ${code}`;
  return c.symbolPosition === "prefix" ? `${c.symbol}${n}` : `${n} ${c.symbol}`;
}

export function ExchangeRates() {
  const rates = rateStore.useItems();
  const currencies = currencyStore.useItems();
  const history = [...rateHistoryStore.useItems()].sort((a, b) => b.at.localeCompare(a.at));
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [now] = useState(() => Date.now());

  const currency = (code: string) => currencies.find((c) => c.code === code);
  const rateFor = (code: string) => (code === BASE_CURRENCY ? 1 : rates.find((r) => r.code === code)?.xafPerUnit ?? 0);
  const rows = [...rates].filter((r) => r.code !== BASE_CURRENCY).sort((a, b) => a.code.localeCompare(b.code));
  const stale = rows.filter((r) => r.xafPerUnit <= 0 || now - new Date(r.asOf).getTime() > STALE_DAYS * DAY);
  const latest = rows.reduce((max, r) => (r.asOf > max ? r.asOf : max), "");

  return (
    <>
      <PageHeading
        title="Exchange rates"
        description={`What one unit of each currency is worth in ${BASE_CURRENCY}. Applicants see fees converted at these rates; what they owe is always the ${BASE_CURRENCY} amount.`}
      />
      <SubNav items={SYSTEM_NAV} current="/admin/config/exchange-rates" />

      <div className="mb-6">
        <StatStrip
          stats={[
            { label: "Rates", value: rows.length, detail: `Against ${BASE_CURRENCY}` },
            { label: "Last updated", value: latest ? formatDate(latest) : "—" },
            { label: "Need attention", value: stale.length, detail: `Missing or older than ${STALE_DAYS} days` },
            { label: "Currencies", value: currencies.length, href: "/admin/config/currencies" },
          ]}
        />
      </div>

      {notice && (
        <p role="status" className="mb-4 border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success)]">
          {notice}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <EmptyState message="No rates yet. Add a currency first; it gets a rate to fill in." />
          ) : (
            <TableFrame>
              <thead>
                <tr>
                  <Th>Currency</Th>
                  <Th className="text-right">{BASE_CURRENCY} per unit</Th>
                  <Th className="text-right">Per 10,000 {BASE_CURRENCY}</Th>
                  <Th>Source</Th>
                  <Th>As of</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
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
                        setNotice(msg);
                      }}
                    />
                  ) : (
                    <tr key={r.code} className="align-top">
                      <Td>
                        <p className="font-medium text-[var(--color-ink)]">{r.code}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{currency(r.code)?.name ?? "Not on the currency list"}</p>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.xafPerUnit > 0 ? r.xafPerUnit.toLocaleString("en-GB", { maximumFractionDigits: 4 }) : <span className="text-[var(--color-danger)]">Not set</span>}
                      </Td>
                      <Td className="text-right tabular-nums text-[var(--color-ink-soft)]">{r.xafPerUnit > 0 ? format(10000 / r.xafPerUnit, currency(r.code), r.code) : "—"}</Td>
                      <Td className="text-[var(--color-ink-soft)]">{r.source}</Td>
                      <Td>
                        <p className="whitespace-nowrap text-[var(--color-ink)]">{formatDate(r.asOf)}</p>
                        {stale.includes(r) && (
                          <span className="mt-1 inline-block">
                            <ToneBadge tone="amber">{r.xafPerUnit > 0 ? "Out of date" : "Missing"}</ToneBadge>
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
                          Update
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
        <SectionHeading title="Rate changes" description="Every update, newest first." />
        {history.length === 0 ? (
          <EmptyState message="No rate has been changed yet." />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Currency</Th>
                <Th className="text-right">From</Th>
                <Th className="text-right">To</Th>
                <Th className="text-right">Change</Th>
                <Th>By</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const pct = h.from > 0 ? ((h.to - h.from) / h.from) * 100 : null;
                return (
                  <tr key={h.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(h.at)}</Td>
                    <Td className="font-medium text-[var(--color-ink)]">{h.code}</Td>
                    <Td className="text-right tabular-nums text-[var(--color-ink-soft)]">{h.from > 0 ? h.from.toLocaleString("en-GB", { maximumFractionDigits: 4 }) : "Not set"}</Td>
                    <Td className="text-right tabular-nums">{h.to.toLocaleString("en-GB", { maximumFractionDigits: 4 })}</Td>
                    <Td className={`text-right tabular-nums ${pct === null ? "" : pct >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                      {pct === null ? "New" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                    </Td>
                    <Td className="text-[var(--color-ink-soft)]">{h.by}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableFrame>
        )}
      </section>
    </>
  );
}

function RateEditRow({ rate, currency, onCancel, onSaved }: { rate: AdminExchangeRate; currency?: AdminCurrency; onCancel: () => void; onSaved: (msg: string) => void }) {
  const [value, setValue] = useState(rate.xafPerUnit > 0 ? String(rate.xafPerUnit) : "");
  const [source, setSource] = useState(rate.source === "Not set" ? "BEAC reference rate" : rate.source);
  const [error, setError] = useState("");

  function save() {
    const n = Number(value);
    if (!value || Number.isNaN(n) || n <= 0) {
      setError("Enter a rate above 0.");
      return;
    }
    if (!source.trim()) {
      setError("Say where the rate comes from.");
      return;
    }
    if (rate.xafPerUnit > 0 && Math.abs(n - rate.xafPerUnit) / rate.xafPerUnit > 0.25 && !window.confirm(`That's more than a 25% change from ${rate.xafPerUnit}. Save it anyway?`)) return;
    const at = new Date().toISOString();
    rateStore.update(rate.id, { xafPerUnit: n, source: source.trim(), asOf: at, updatedBy: "AOSA administrator" });
    if (n !== rate.xafPerUnit) rateHistoryStore.add({ id: newId("rc"), code: rate.code, from: rate.xafPerUnit, to: n, at, by: "AOSA administrator" });
    onSaved(`${rate.code} rate set to ${n.toLocaleString("en-GB", { maximumFractionDigits: 4 })} ${BASE_CURRENCY}.`);
  }

  return (
    <tr className="bg-[var(--color-paper)] align-top">
      <Td>
        <p className="font-medium text-[var(--color-ink)]">{rate.code}</p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{currency?.name}</p>
      </Td>
      <Td colSpan={4}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`${BASE_CURRENCY} for 1 ${rate.code}`} error={error}>
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
                if (e.key === "Enter") save();
                if (e.key === "Escape") onCancel();
              }}
            />
          </Field>
          <Field label="Source">
            <TextInput value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
        </div>
      </Td>
      <Td>
        <div className="flex flex-col gap-2">
          <PrimaryButton type="button" onClick={save}>
            Save
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onCancel}>
            Cancel
          </SecondaryButton>
        </div>
      </Td>
    </tr>
  );
}

function Converter({ currencies, rateFor, format }: { currencies: AdminCurrency[]; rateFor: (code: string) => number; format: (n: number, code: string) => string }) {
  const [amount, setAmount] = useState("25000");
  const [from, setFrom] = useState(BASE_CURRENCY);
  const [to, setTo] = useState("EUR");
  const n = Number(amount);
  const fromRate = rateFor(from);
  const toRate = rateFor(to);
  const result = fromRate > 0 && toRate > 0 && amount !== "" && !Number.isNaN(n) ? (n * fromRate) / toRate : Number.NaN;

  return (
    <Card className="self-start">
      <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Converter</p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Check a rate the way applicants will see it.</p>
      <div className="mt-4 space-y-3">
        <Field label="Amount">
          <TextInput type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label="From">
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
            aria-label="Swap currencies"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="mb-0.5 border border-[var(--color-line-strong)] p-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <ArrowRightLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <Field label="To">
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
        <p className="font-[var(--font-display)] text-2xl tabular-nums text-[var(--color-ink)]">{format(result, to)}</p>
        <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
          {fromRate > 0 && toRate > 0 ? `1 ${from} = ${(fromRate / toRate).toLocaleString("en-GB", { maximumFractionDigits: 6 })} ${to}` : "No rate set for one of these currencies."}
        </p>
      </div>
    </Card>
  );
}
