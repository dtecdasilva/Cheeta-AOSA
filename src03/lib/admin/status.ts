import type { ApplicationStatus } from "@/lib/types";

/**
 * Status vocabulary from the administrator's point of view. The applicant
 * portal's StatusBadge says "Acknowledged by you" / "Declined by you"; an
 * administrator needs to know *who* did it, so the labels differ even
 * though the underlying statuses are the same.
 */
export const ADMIN_STATUS_LABELS: Record<ApplicationStatus, string> = {
  INCOMPLETE: "Incomplete",
  COMPLETED: "Completed",
  SUBMITTED: "Submitted",
  RESUBMITTED: "Resubmitted",
  I_ACKNOWLEDGED: "Acknowledged by institution",
  I_REJECTED: "Rejected by institution",
  ACCEPTED: "Accepted",
  A_ACKNOWLEDGED: "Offer taken up",
  A_REJECTED: "Offer declined",
};

export const ALL_STATUSES: ApplicationStatus[] = [
  "INCOMPLETE",
  "COMPLETED",
  "SUBMITTED",
  "RESUBMITTED",
  "I_ACKNOWLEDGED",
  "I_REJECTED",
  "ACCEPTED",
  "A_ACKNOWLEDGED",
  "A_REJECTED",
];

export type StatusTone = "neutral" | "info" | "amber" | "success" | "danger";

export const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  INCOMPLETE: "neutral",
  COMPLETED: "info",
  SUBMITTED: "amber",
  RESUBMITTED: "amber",
  I_ACKNOWLEDGED: "info",
  I_REJECTED: "danger",
  ACCEPTED: "success",
  A_ACKNOWLEDGED: "success",
  A_REJECTED: "danger",
};

/**
 * The groups the dashboard reports on. A status belongs to exactly one
 * group so the tiles add up.
 */
export type StatusGroup = "draft" | "awaiting" | "acknowledged" | "rejected" | "accepted" | "declined";

export const STATUS_GROUP: Record<ApplicationStatus, StatusGroup> = {
  INCOMPLETE: "draft",
  COMPLETED: "draft",
  SUBMITTED: "awaiting",
  RESUBMITTED: "awaiting",
  I_ACKNOWLEDGED: "acknowledged",
  I_REJECTED: "rejected",
  ACCEPTED: "accepted",
  A_ACKNOWLEDGED: "accepted",
  A_REJECTED: "declined",
};

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  draft: "Not yet submitted",
  awaiting: "Awaiting institution",
  acknowledged: "Acknowledged",
  rejected: "Rejected",
  accepted: "Accepted",
  declined: "Offer declined",
};

// ---------------------------------------------------------------------------
// Progression stages
// ---------------------------------------------------------------------------

export type StageKey = "started" | "completed" | "paid" | "submitted" | "acknowledged" | "decided" | "responded";

export const STAGES: { key: StageKey; label: string; description: string }[] = [
  { key: "started", label: "Started", description: "The applicant opened an application." },
  { key: "completed", label: "Completed", description: "Every section of the application is filled in." },
  { key: "paid", label: "Fees paid", description: "The application and web fees have been received." },
  { key: "submitted", label: "Submitted", description: "Sent to the institution for review." },
  { key: "acknowledged", label: "Acknowledged", description: "The institution confirmed it received the application." },
  { key: "decided", label: "Decision", description: "The institution accepted or rejected the application." },
  { key: "responded", label: "Offer response", description: "The applicant took up or declined the offer." },
];

interface ProgressionInput {
  history: { status: ApplicationStatus }[];
  payment: { status: "PAID" | "PENDING" | "FAILED" } | null;
}

export function reachedStages(app: ProgressionInput): Set<StageKey> {
  const seen = new Set(app.history.map((h) => h.status));
  const out = new Set<StageKey>(["started"]);
  if (seen.has("COMPLETED")) out.add("completed");
  if (app.payment?.status === "PAID") out.add("paid");
  if (seen.has("SUBMITTED")) out.add("submitted");
  if (seen.has("I_ACKNOWLEDGED")) out.add("acknowledged");
  if (seen.has("ACCEPTED") || seen.has("I_REJECTED")) out.add("decided");
  if (seen.has("A_ACKNOWLEDGED") || seen.has("A_REJECTED")) out.add("responded");
  return out;
}

/**
 * How a stage turned out, for the stages where that's more than
 * "reached": the decision (accepted/rejected) and the offer response.
 */
export function stageOutcome(app: ProgressionInput, key: StageKey): { label: string; tone: StatusTone } | null {
  const seen = new Set(app.history.map((h) => h.status));
  if (key === "decided") {
    if (seen.has("ACCEPTED")) return { label: "Accepted", tone: "success" };
    if (seen.has("I_REJECTED")) return { label: "Rejected", tone: "danger" };
  }
  if (key === "responded") {
    if (seen.has("A_ACKNOWLEDGED")) return { label: "Taken up", tone: "success" };
    if (seen.has("A_REJECTED")) return { label: "Declined", tone: "danger" };
  }
  if (key === "paid" && app.payment && app.payment.status !== "PAID") {
    return { label: app.payment.status === "PENDING" ? "Pending" : "Failed", tone: app.payment.status === "PENDING" ? "amber" : "danger" };
  }
  return null;
}

/** A rejected application stops progressing; stages after the decision don't apply. */
export function isStageApplicable(app: ProgressionInput, key: StageKey): boolean {
  if (key === "responded") return !app.history.some((h) => h.status === "I_REJECTED");
  return true;
}

export function stageIndex(key: StageKey): number {
  return STAGES.findIndex((s) => s.key === key);
}

export function stageLabel(key: StageKey): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

/** The furthest stage reached, in stage order. */
export function furthestStage(app: ProgressionInput): StageKey {
  const reached = reachedStages(app);
  let last: StageKey = "started";
  for (const s of STAGES) if (reached.has(s.key)) last = s.key;
  return last;
}
