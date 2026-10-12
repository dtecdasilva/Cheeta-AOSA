/**
 * The starting list of currencies and rates.
 *
 * Currencies and exchange rates are stored in the database and managed in
 * the Administration portal. This file is what an empty database is first
 * filled from, and what currency pickers and amounts are formatted with
 * for the moment before the stored list has loaded.
 *
 * Nothing converts money with the rates below. Every converted amount on
 * a screen is worked out by the server from the rates on record (see
 * src/server/modules/fees/calculation.ts) and sent with the figures.
 *
 * XAF is the platform's base currency. Each rate is "how many XAF equal
 * one unit of this currency". EUR's (655.957) is the real peg the CFA
 * franc has held to the euro for decades; the rest are plausible starting
 * values for the administrator to replace.
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
  /** The date the starting value is given as applying from. */
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

/**
 * Formats a numeric amount using the given currency's own conventions
 * (decimal places, symbol, and whether the symbol goes before or after
 * the number) — not a generic Intl.NumberFormat("currency") call, so the
 * symbol above (e.g. "FCFA") is what renders, not whatever a runtime's
 * built-in currency-symbol table happens to map XAF to. Screens should
 * prefer useMoneyFormat() (./useCurrencies.ts), which formats with the
 * stored currency list; this uses the starting list only.
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
