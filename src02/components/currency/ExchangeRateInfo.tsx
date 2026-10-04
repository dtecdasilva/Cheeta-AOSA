import { AlertTriangle } from "lucide-react";
import { convertAmount, getExchangeRate } from "@/lib/currency/data";
import { FormattedCurrencyAmount } from "./FormattedCurrencyAmount";

/**
 * Shows the mock exchange rate between two currencies — "1 USD ≈ 610.50
 * XAF" — with an explicit, visible note that this is illustrative mock
 * data, not a live rate. "Do not implement live exchange-rate APIs"
 * means this component's job is to be useful for a demo while never
 * pretending to be a real, current rate.
 */
export function ExchangeRateInfo({ fromCode, toCode, className }: { fromCode: string; toCode: string; className?: string }) {
  const fromRate = getExchangeRate(fromCode);
  const toRate = getExchangeRate(toCode);
  const oneUnitConverted = convertAmount(1, fromCode, toCode);

  if (!fromRate || !toRate || oneUnitConverted === null) {
    return (
      <p className={`flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)] ${className ?? ""}`}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        No mock exchange rate on file for {fromCode} → {toCode}.
      </p>
    );
  }

  const asOf = fromRate.asOf > toRate.asOf ? fromRate.asOf : toRate.asOf;

  return (
    <p className={`text-xs text-[var(--color-ink-faint)] ${className ?? ""}`}>
      1 {fromCode} ≈ <FormattedCurrencyAmount amount={oneUnitConverted} code={toCode} /> — mock rate, not live, as
      of {asOf}
    </p>
  );
}
