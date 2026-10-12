import { CURRENCIES, CurrencyInfo } from "./data";

/**
 * The currencies applicants can view fees in, from the database
 * (/api/reference/currencies: the active ones the administrator has
 * switched on for applicants).
 *
 * Asked for once per page load and shared by everything that needs it.
 * If the list can't be read (offline, or the server is down), the
 * starting list in data.ts is used instead so pickers and amounts still
 * render; the next page load tries again.
 */
let cached: Promise<CurrencyInfo[]> | null = null;

async function load(): Promise<CurrencyInfo[]> {
  try {
    const res = await fetch("/api/reference/currencies", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { data: CurrencyInfo[] };
    if (!body.data.length) throw new Error("empty");
    return body.data.map((c) => ({ code: c.code, symbol: c.symbol, name: c.name, decimalDigits: c.decimalDigits, symbolPosition: c.symbolPosition }));
  } catch {
    cached = null;
    return [...CURRENCIES];
  }
}

export function getCurrencies(): Promise<CurrencyInfo[]> {
  // On the server there is no session to read the list with; the starting list stands in.
  if (typeof window === "undefined") return Promise.resolve([...CURRENCIES]);
  return (cached ??= load());
}
