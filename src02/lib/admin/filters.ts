/** Filtering helpers shared by every admin list. */

export interface DateRange {
  /** yyyy-mm-dd, inclusive. Empty means unbounded. */
  from: string;
  to: string;
}

export const EMPTY_RANGE: DateRange = { from: "", to: "" };

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const DATE_PRESETS: { key: string; label: string; range: () => DateRange }[] = [
  { key: "all", label: "All time", range: () => EMPTY_RANGE },
  { key: "7", label: "Last 7 days", range: () => lastDays(7) },
  { key: "30", label: "Last 30 days", range: () => lastDays(30) },
  { key: "90", label: "Last 90 days", range: () => lastDays(90) },
  {
    key: "year",
    label: "This year",
    range: () => {
      const now = new Date();
      return { from: `${now.getUTCFullYear()}-01-01`, to: isoDay(now) };
    },
  },
];

function lastDays(n: number): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - (n - 1) * 86_400_000);
  return { from: isoDay(from), to: isoDay(to) };
}

export function presetFor(range: DateRange): string | null {
  const hit = DATE_PRESETS.find((p) => {
    const r = p.range();
    return r.from === range.from && r.to === range.to;
  });
  return hit?.key ?? null;
}

export function inRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** True when every word of the query appears in one of the fields. */
export function matchesSearch(query: string, fields: (string | undefined | null)[]): boolean {
  const q = normalize(query);
  if (!q) return true;
  const hay = normalize(fields.filter(Boolean).join(" "));
  return q.split(/\s+/).every((word) => hay.includes(word));
}

export function describeRange(range: DateRange): string {
  if (!range.from && !range.to) return "all time";
  if (range.from && range.to) return `${range.from} to ${range.to}`;
  if (range.from) return `from ${range.from}`;
  return `up to ${range.to}`;
}
