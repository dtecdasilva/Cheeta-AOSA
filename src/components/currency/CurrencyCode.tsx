import { getCurrencyInfo } from "@/lib/currency/data";

/**
 * Renders a currency's ISO code as a small label, e.g. "XAF". Shown with
 * a muted, slightly separated style so it reads as metadata next to an
 * amount rather than part of the amount itself. Flags an unrecognized
 * code visually rather than silently rendering it identically to a
 * valid one.
 */
export function CurrencyCode({ code, className }: { code: string; className?: string }) {
  const known = !!getCurrencyInfo(code);
  return (
    <span
      className={`inline-block border border-[var(--color-line)] px-1.5 py-0.5 text-xs font-medium tracking-wide ${
        known ? "text-[var(--color-ink-soft)]" : "text-[var(--color-danger)]"
      } ${className ?? ""}`}
      title={known ? undefined : "Unrecognized currency code"}
    >
      {code}
    </span>
  );
}
