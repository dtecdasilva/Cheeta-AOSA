import { formatAmount } from "@/lib/currency/data";

/**
 * Renders a numeric amount formatted according to its currency's own
 * conventions (decimal places, and symbol before or after the number) —
 * the single place amount formatting happens, so every price shown in
 * the app looks consistent without each screen reimplementing the rules.
 */
export function FormattedCurrencyAmount({
  amount,
  code,
  className,
}: {
  amount: number;
  code: string;
  className?: string;
}) {
  return <span className={className}>{formatAmount(amount, code)}</span>;
}
