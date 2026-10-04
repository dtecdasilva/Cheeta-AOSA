/**
 * Document type keys, with no dependencies, so server pages can validate
 * a URL segment without pulling in the client-side mock stores.
 */
export const DOC_TYPE_KEYS = [
  "application-summary",
  "completed-application",
  "submission-confirmation",
  "payment-record",
  "admission-letter",
  "matriculation-record",
] as const;

export type DocType = (typeof DOC_TYPE_KEYS)[number];
export const isDocType = (s: string): s is DocType => (DOC_TYPE_KEYS as readonly string[]).includes(s);
