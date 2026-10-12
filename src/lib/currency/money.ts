/**
 * Arithmetic for converting money, shared by the server (which works out
 * every figure that is stored or charged) and the screens (which only
 * format what the server sent).
 *
 * No imports, so anything can use it.
 */

/** Decimal places a rate is carried to once it has been derived (read the other way round, or crossed). */
export const RATE_DECIMALS = 12;

/**
 * Rounds half away from zero to `decimals` places. Works on the decimal
 * digits, not the binary value, so 1.005 rounds to 1.01 rather than 1.00.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  // Written out as plain decimal digits (never 1e-7), a few places past the ones being kept.
  const digits = Math.abs(value).toFixed(Math.min(decimals + 8, 100));
  const rounded = Number(`${Math.round(Number(`${digits}e${decimals}`))}e-${decimals}`);
  return value < 0 ? -rounded : rounded;
}

export const roundRate = (rate: number) => roundTo(rate, RATE_DECIMALS);

/**
 * `amount` of one currency in another, at `rate` (units of the target per
 * one unit of the source), rounded to the target currency's decimal
 * places. This one line is the whole of a conversion: every converted
 * amount on the platform is `amount x rate`, rounded.
 */
export function convertAt(amount: number, rate: number, decimals: number): number {
  return roundTo(amount * rate, decimals);
}

export interface CurrencyFormat {
  code: string;
  symbol: string;
  decimalDigits: number;
  symbolPosition: "prefix" | "suffix";
}

/** "12,000 FCFA", "$19.65": the amount in the currency's own style. Falls back to "19.65 USD" for a currency it has no format for. */
export function formatMoney(amount: number, code: string, format?: CurrencyFormat | null): string {
  const digits = format?.decimalDigits ?? 2;
  const number = amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (!format) return `${number} ${code}`;
  return format.symbolPosition === "prefix" ? `${format.symbol}${number}` : `${number} ${format.symbol}`;
}
