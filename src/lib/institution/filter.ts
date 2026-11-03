/**
 * Searching the institution portal's lists. Matching is case- and
 * accent-insensitive ("ecole" finds "École") and every word typed must
 * appear somewhere in the record, in any order, so "law yaounde" finds
 * "Faculty of Law · Yaoundé".
 */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** True when every word of `query` appears in at least one of the given fields. An empty query matches everything. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(fields.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}

export const STATUS_FILTER_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];
