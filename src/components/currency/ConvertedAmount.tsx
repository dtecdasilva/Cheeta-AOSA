"use client";

import { useMoneyFormat } from "@/lib/currency/useCurrencies";

/**
 * Shows an amount with its equivalent in another currency —
 * "12,000 FCFA ≈ $19.65".
 *
 * It does no arithmetic. `converted` is the figure the server worked out
 * (from the exchange rate on record, or from the rate stored with a
 * payment) and it is shown exactly as given, so a screen can never
 * disagree with what was calculated or recorded. With no converted figure
 * (the two currencies are the same, or there is no rate) only the
 * original amount is shown.
 */
export function ConvertedAmount({
  amount,
  fromCode,
  toCode,
  converted,
  stacked,
  className,
}: {
  amount: number;
  fromCode: string;
  /** The currency of `converted`. */
  toCode?: string | null;
  /** The amount in `toCode`, as calculated by the server. */
  converted?: number | null;
  /** Put the converted figure on its own line under the amount, for narrow table cells. */
  stacked?: boolean;
  className?: string;
}) {
  const format = useMoneyFormat();
  if (!toCode || toCode === fromCode || converted === null || converted === undefined) {
    return <span className={`whitespace-nowrap ${className ?? ""}`}>{format(amount, fromCode)}</span>;
  }
  return (
    <span className={className}>
      <span className="whitespace-nowrap">{format(amount, fromCode)}</span>{stacked ? "" : " "}
      <span className={`whitespace-nowrap font-normal text-[var(--color-ink-faint)] ${stacked ? "block text-xs" : ""}`}>≈ {format(converted, toCode)}</span>
    </span>
  );
}
