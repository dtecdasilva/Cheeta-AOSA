import type { AuditCategory } from "@/lib/audit/categories";

/** Configuration Cheeta administration or an institution sets up, as opposed to records of what people did. */
const CONFIGURATION = new Set([
  "settings",
  "parameter",
  "country",
  "currency",
  "exchange-rate",
  "fee",
  "institution",
  "faculty",
  "department",
  "program",
  "payment-method",
  "institution-payment-method",
  "upload-requirement",
  "upload requirement",
  "payment method",
  "notification-template",
  "tuition-requirement",
  "medical-requirement",
  "admission-rule",
]);

const APPLICATION = new Set(["application-bundle", "program-choices", "education-record", "examination-record", "examination-result", "demographic-profile", "display-currency", "application-comment"]);

const AUTH_ACTIONS = new Set(["login", "login_failed", "login_blocked", "logout", "password_reset", "password_reset_requested", "email_verified"]);

/** Decision verbs: the record was checked and a ruling made on it. */
const VERIFY_ACTIONS = new Set(["approve", "reject", "verify", "verify-payment", "query", "reopen", "review"]);

/**
 * The category of an audit entry. For an application's status change, the
 * new status decides it (SUBMITTED is a submission, I_REJECTED a rejection,
 * and so on); otherwise what was acted on, then how.
 */
export function categoryOf(action: string, entityType: string, after?: Record<string, unknown> | null): AuditCategory {
  if (entityType === "account" && AUTH_ACTIONS.has(action)) return "authentication";
  if (entityType === "account" && action === "register") return "registration";
  if (entityType === "permission") return "permissions";
  if (entityType === "account" || entityType === "staff") return "users";

  if (entityType === "application") {
    const to = typeof after?.status === "string" ? after.status : null;
    if (action === "submit" || to === "SUBMITTED") return "submission";
    if (to === "RESUBMITTED") return "resubmission";
    if (action === "acknowledge" || to === "I_ACKNOWLEDGED" || to === "A_ACKNOWLEDGED") return "acknowledgement";
    if (to === "I_REJECTED" || to === "A_REJECTED" || action === "reject") return "rejection";
    if (to === "ACCEPTED") return "admission";
    if (action === "verify-payment") return "verification";
    return "application";
  }
  if (APPLICATION.has(entityType)) return "application";

  if (entityType === "fee-payment" || entityType === "tuition-payment" || entityType === "tuition-account") return VERIFY_ACTIONS.has(action) ? "verification" : "payment";
  if (entityType === "application-document") return action === "review" ? "verification" : "upload";
  if (entityType === "medical-record") return "verification";
  if (entityType === "file") return "upload";

  if (entityType === "deliberation" || entityType === "deliberation-run" || entityType === "deliberation-subscription") return "deliberation";
  if (entityType === "admission") return "admission";
  if (entityType === "matriculation") return "matriculation";
  if (CONFIGURATION.has(entityType)) return "configuration";
  if (entityType === "document" || entityType === "notification-delivery") return "documents";
  return "other";
}
