import { convertAmount, formatAmount } from "@/lib/currency/data";

/**
 * Shows an amount converted from one currency to another using the mock
 * exchange rates — "12,000 FCFA ≈ $19.65". Renders just the original
 * amount if the two currencies are the same, and a plain-language
 * fallback if either currency has no mock rate on file, rather than a
 * wrong or NaN-looking number.
 */
export function ConvertedAmount({
  amount,
  fromCode,
  toCode,
  className,
}: {
  amount: number;
  fromCode: string;
  toCode: string;
  className?: string;
}) {
  if (fromCode === toCode) {
    return <span className={className}>{formatAmount(amount, fromCode)}</span>;
  }

  const converted = convertAmount(amount, fromCode, toCode);

  if (converted === null) {
    return (
      <span className={className}>
        {formatAmount(amount, fromCode)}{" "}
        <span className="text-[var(--color-ink-faint)]">(conversion to {toCode} unavailable)</span>
      </span>
    );
  }

  return (
    <span className={className}>
      {formatAmount(amount, fromCode)} <span className="text-[var(--color-ink-faint)]">≈</span>{" "}
      {formatAmount(converted, toCode)}
    </span>
  );
}
