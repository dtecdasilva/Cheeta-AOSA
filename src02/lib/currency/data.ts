/**
 * The one place currency and exchange-rate data is defined. Every
 * currency component in src/components/currency/ reads from here —
 * never its own inline list or its own conversion math.
 *
 * XAF (the CFA franc used by the mock institutions in src/lib/data.ts)
 * is the platform's base currency: fees are entered and stored in XAF,
 * and every exchange rate below is expressed as "how many XAF equal one
 * unit of this currency" — the same way a bank quotes a rate against a
 * base currency. EUR's rate (655.957) is the real, actual peg the CFA
 * franc has held to the euro for decades; the rest are plausible but
 * invented, not fetched from anywhere.
 */

export interface CurrencyInfo {
  code: string; // ISO 4217, e.g. "XAF"
  symbol: string; // e.g. "FCFA", "$", "€"
  name: string;
  decimalDigits: number; // XAF is conventionally shown with none
  symbolPosition: "prefix" | "suffix";
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "XAF", symbol: "FCFA", name: "Central African CFA Franc", decimalDigits: 0, symbolPosition: "suffix" },
  { code: "USD", symbol: "$", name: "US Dollar", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "EUR", symbol: "€", name: "Euro", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "GBP", symbol: "£", name: "British Pound", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "ZAR", symbol: "R", name: "South African Rand", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimalDigits: 2, symbolPosition: "prefix" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimalDigits: 2, symbolPosition: "suffix" },
];

export interface ExchangeRate {
  code: string;
  /** How many XAF equal 1 unit of `code`. XAF's own entry is exactly 1. */
  xafPerUnit: number;
  /** Mock "last updated" date, purely illustrative — this is not a live rate. */
  asOf: string;
}

export const MOCK_EXCHANGE_RATES: ExchangeRate[] = [
  { code: "XAF", xafPerUnit: 1, asOf: "2026-09-01" },
  { code: "USD", xafPerUnit: 610.5, asOf: "2026-09-01" },
  { code: "EUR", xafPerUnit: 655.957, asOf: "2026-09-01" },
  { code: "GBP", xafPerUnit: 770.2, asOf: "2026-09-01" },
  { code: "NGN", xafPerUnit: 0.4, asOf: "2026-09-01" },
  { code: "GHS", xafPerUnit: 40.1, asOf: "2026-09-01" },
  { code: "ZAR", xafPerUnit: 33.8, asOf: "2026-09-01" },
  { code: "CAD", xafPerUnit: 445.0, asOf: "2026-09-01" },
  { code: "CNY", xafPerUnit: 84.5, asOf: "2026-09-01" },
  { code: "AED", xafPerUnit: 166.2, asOf: "2026-09-01" },
];

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function getExchangeRate(code: string): ExchangeRate | undefined {
  return MOCK_EXCHANGE_RATES.find((r) => r.code === code);
}

/**
 * Formats a numeric amount using the given currency's own conventions
 * (decimal places, symbol, and whether the symbol goes before or after
 * the number) — not a generic Intl.NumberFormat("currency") call, so the
 * exact mock symbol above (e.g. "FCFA") is what renders, not whatever a
 * runtime's built-in currency-symbol table happens to map XAF to.
 */
export function formatAmount(amount: number, code: string): string {
  const info = getCurrencyInfo(code);
  const digits = info?.decimalDigits ?? 2;
  const number = amount.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (!info) return `${number} ${code}`;
  return info.symbolPosition === "prefix" ? `${info.symbol}${number}` : `${number} ${info.symbol}`;
}

/**
 * Converts an amount from one currency to another using the mock rates
 * above, via XAF as the pivot — the same way a real multi-currency
 * conversion would pivot through a base currency. Returns null if either
 * currency's rate isn't in the mock table, so callers can show "rate
 * unavailable" instead of a wrong number.
 */
export function convertAmount(amount: number, fromCode: string, toCode: string): number | null {
  if (fromCode === toCode) return amount;
  const from = getExchangeRate(fromCode);
  const to = getExchangeRate(toCode);
  if (!from || !to) return null;
  const amountInXaf = amount * from.xafPerUnit;
  return amountInXaf / to.xafPerUnit;
}
