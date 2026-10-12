import type { ApplicationStatus } from "@/lib/types";

/**
 * The application status engine: every status an application to one
 * institution can be in, which status it can move to next, and who
 * moves it. The backend enforces this (src/server/modules/applications/
 * applications.workflow.ts) and records every move; screens use the same
 * table to decide which actions to offer.
 *
 *   INCOMPLETE ⇄ COMPLETED ─▶ SUBMITTED ─▶ I_ACKNOWLEDGED ─▶ ACCEPTED ─▶ A_ACKNOWLEDGED
 *     (system)    (applicant)     │               │             └──────▶ A_REJECTED
 *                                 └──▶ I_REJECTED ◀┘                    (applicant)
 *   I_REJECTED / I_ACKNOWLEDGED ─▶ RESUBMITTED (applicant corrects) ─▶ I_ACKNOWLEDGED | I_REJECTED
 *
 * INCOMPLETE and COMPLETED are set by the platform, never chosen: an
 * application is COMPLETED when everything it needs is in place, and goes
 * back to INCOMPLETE if something it needs is taken away. Only a
 * COMPLETED application can be submitted.
 */

export type StatusActor = "applicant" | "institution" | "system" | "admin";

export const TRANSITIONS: Record<ApplicationStatus, Partial<Record<ApplicationStatus, StatusActor[]>>> = {
  INCOMPLETE: { COMPLETED: ["system"] },
  COMPLETED: { INCOMPLETE: ["system"], SUBMITTED: ["applicant"] },
  SUBMITTED: { I_ACKNOWLEDGED: ["institution", "admin"], I_REJECTED: ["institution", "admin"] },
  RESUBMITTED: { I_ACKNOWLEDGED: ["institution", "admin"], I_REJECTED: ["institution", "admin"] },
  I_ACKNOWLEDGED: { ACCEPTED: ["institution", "admin"], I_REJECTED: ["institution", "admin"], RESUBMITTED: ["applicant"] },
  I_REJECTED: { RESUBMITTED: ["applicant"] },
  ACCEPTED: { A_ACKNOWLEDGED: ["applicant"], A_REJECTED: ["applicant"] },
  A_ACKNOWLEDGED: {},
  A_REJECTED: {},
};

/** What each status means, in a sentence. */
export const STATUS_DESCRIPTIONS: Record<ApplicationStatus, string> = {
  INCOMPLETE: "Being prepared: something the application needs is still missing.",
  COMPLETED: "Everything is in place; the applicant can submit it.",
  SUBMITTED: "Submitted to the institution, waiting for it to be reviewed.",
  RESUBMITTED: "Corrected by the applicant and sent back to the institution.",
  I_ACKNOWLEDGED: "Reviewed and acknowledged by the institution; on its deliberation list.",
  I_REJECTED: "Rejected by the institution.",
  ACCEPTED: "The institution has offered the applicant a place.",
  A_ACKNOWLEDGED: "The applicant has taken up the offer.",
  A_REJECTED: "The applicant has declined the offer.",
};

/** Statuses with nothing after them. */
export const FINAL_STATUSES: ApplicationStatus[] = ["A_ACKNOWLEDGED", "A_REJECTED"];

/** Statuses an application is in once it has been sent to the institution at least once. */
export const SUBMITTED_STATUSES: ApplicationStatus[] = ["SUBMITTED", "RESUBMITTED", "I_ACKNOWLEDGED", "I_REJECTED", "ACCEPTED", "A_ACKNOWLEDGED", "A_REJECTED"];

/** Waiting for the institution's review. */
export const AWAITING_REVIEW_STATUSES: ApplicationStatus[] = ["SUBMITTED", "RESUBMITTED"];

export function canTransition(from: ApplicationStatus, to: ApplicationStatus, actor: StatusActor): boolean {
  return TRANSITIONS[from]?.[to]?.includes(actor) ?? false;
}

export function nextStatuses(from: ApplicationStatus, actor: StatusActor): ApplicationStatus[] {
  return (Object.entries(TRANSITIONS[from] ?? {}) as [ApplicationStatus, StatusActor[]][]).filter(([, actors]) => actors.includes(actor)).map(([s]) => s);
}

/** Before submission, the applicant can still change choices, documents and institutions. */
export const EDITABLE_STATUSES: ApplicationStatus[] = ["INCOMPLETE", "COMPLETED"];

/** The applicant may change an application the institution sent back. */
export const CORRECTABLE_STATUSES: ApplicationStatus[] = ["INCOMPLETE", "COMPLETED", "I_ACKNOWLEDGED", "I_REJECTED"];
