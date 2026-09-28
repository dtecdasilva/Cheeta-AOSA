/** Report keys, dependency-free so server pages can validate the URL. */
export const REPORT_KEYS = [
  "student-registration",
  "applications",
  "application-progression",
  "payments",
  "acknowledged-applications",
  "rejected-applications",
  "deliberation",
  "admission",
  "tuition",
  "medical-verification",
  "matriculation",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];
export const isReportKey = (s: string): s is ReportKey => (REPORT_KEYS as readonly string[]).includes(s);

/** Platform registration is AOSA's business, not an institution's. */
export function reportsFor(scope: "admin" | "institution"): ReportKey[] {
  return REPORT_KEYS.filter((k) => scope === "admin" || k !== "student-registration");
}
