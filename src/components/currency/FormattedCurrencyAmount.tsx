"use client";

import { useMoneyFormat } from "@/lib/currency/useCurrencies";

/**
 * Renders a numeric amount formatted according to its currency's own
 * conventions (decimal places, and symbol before or after the number) —
 * the single place amount formatting happens, so every price shown in
 * the app looks consistent without each screen reimplementing the rules.
 * The conventions come from the stored currency list.
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
  const format = useMoneyFormat();
  return <span className={className}>{format(amount, code)}</span>;
}
