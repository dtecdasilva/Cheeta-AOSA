/**
 * What an audit entry is about, for filtering the trail. Worked out when
 * the entry is written (server/audit/audit.ts) from what was done to what.
 */
export const AUDIT_CATEGORIES = {
  authentication: "Authentication",
  registration: "Registration",
  application: "Application changes",
  submission: "Submission",
  payment: "Payments",
  verification: "Verification",
  upload: "Uploads",
  acknowledgement: "Acknowledgement",
  rejection: "Rejection",
  resubmission: "Resubmission",
  deliberation: "Deliberation",
  admission: "Admission",
  configuration: "Configuration changes",
  users: "User management",
  permissions: "Permission changes",
  matriculation: "Matriculation",
  documents: "Documents and notifications",
  other: "Other",
} as const;

export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export const isAuditCategory = (s: string): s is AuditCategory => s in AUDIT_CATEGORIES;
