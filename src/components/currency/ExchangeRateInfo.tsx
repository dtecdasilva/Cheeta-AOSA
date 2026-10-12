"use client";

import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

/**
 * States the exchange rate behind a set of converted amounts —
 * "1 USD = 610.50 XAF · BEAC reference rate, in effect since 01 Sep 2026".
 *
 * The rate is the one the server used, passed in with the amounts it
 * produced; this component doesn't look one up. `unavailable` is for a
 * display currency that has no rate on record.
 */
export function ExchangeRateInfo({
  baseCode,
  code,
  basePerUnit,
  source,
  effectiveFrom,
  unavailable,
  className,
}: {
  /** The currency amounts are owed in. */
  baseCode: string;
  /** The currency they are being shown in. */
  code: string;
  /** How much of the base currency one unit of `code` is worth. */
  basePerUnit?: number;
  source?: string;
  effectiveFrom?: string;
  unavailable?: boolean;
  className?: string;
}) {
  if (unavailable || !basePerUnit) {
    return (
      <p className={`flex items-center gap-1.5 text-xs text-[var(--color-warning-strong)] ${className ?? ""}`}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        There is no exchange rate for {code} at the moment, so amounts are shown in {baseCode} only.
      </p>
    );
  }
  // More decimal places than the currency is counted in, so a rate such as 0.4 or 655.957 isn't rounded away.
  const rate = basePerUnit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  return (
    <p className={`text-xs text-[var(--color-ink-faint)] ${className ?? ""}`}>
      1 {code} = {rate} {baseCode}
      {source ? ` · ${source}` : ""}
      {effectiveFrom ? `, in effect since ${formatDate(effectiveFrom)}` : ""}
    </p>
  );
}
