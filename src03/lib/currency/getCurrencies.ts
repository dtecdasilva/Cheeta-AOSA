import { CURRENCIES, CurrencyInfo } from "./data";

/**
 * Returns the list of currencies, shaped as a Promise even though today
 * it just resolves the static mock list in data.ts — the same pattern as
 * getCountries() (src/lib/countries/getCountries.ts). "Do not implement
 * live exchange-rate APIs" rules out a real call today; this is the seam
 * a real one (or a database-backed config, matching Education
 * Information's pattern) plugs into later without touching
 * <CurrencySelector> or anything else that calls this.
 *
 * The synchronous helpers in data.ts (getCurrencyInfo, formatAmount,
 * convertAmount) are used directly by the small inline display
 * components (CurrencySymbol, CurrencyCode, FormattedCurrencyAmount,
 * ConvertedAmount, ExchangeRateInfo) rather than going through this
 * async accessor — those are meant to render instantly wherever they're
 * dropped in, not show a loading flicker for static mock data. This
 * accessor exists for the one place a brief load is expected and fine:
 * populating <CurrencySelector>'s option list.
 */
let cached: Promise<CurrencyInfo[]> | null = null;

export function getCurrencies(): Promise<CurrencyInfo[]> {
  if (!cached) {
    cached = Promise.resolve([...CURRENCIES]);
  }
  return cached;
}
