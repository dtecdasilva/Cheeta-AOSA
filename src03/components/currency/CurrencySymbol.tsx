import { getCurrencyInfo } from "@/lib/currency/data";

/**
 * Renders just a currency's symbol (e.g. "FCFA", "$", "€") given its
 * code. Falls back to the code itself if it's not in the mock list,
 * rather than rendering nothing.
 */
export function CurrencySymbol({ code, className }: { code: string; className?: string }) {
  const info = getCurrencyInfo(code);
  return <span className={className}>{info?.symbol ?? code}</span>;
}
