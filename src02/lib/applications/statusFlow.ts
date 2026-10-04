import type { ApplicationStatus } from "@/lib/types";

/**
 * Which status an application can move to next, and who moves it. The
 * backend enforces this; screens can use it to decide which actions to
 * offer. It's the same path the admin portal's demo data follows
 * (src/lib/admin/students.ts).
 *
 *   INCOMPLETE ─▶ COMPLETED ─▶ SUBMITTED ─▶ I_ACKNOWLEDGED ─▶ ACCEPTED ─▶ A_ACKNOWLEDGED
 *                                  │               │             └──────▶ A_REJECTED
 *                                  └──▶ I_REJECTED ◀┘
 *   I_REJECTED / I_ACKNOWLEDGED ─▶ RESUBMITTED (applicant corrects) ─▶ I_ACKNOWLEDGED | I_REJECTED
 */

export type StatusActor = "applicant" | "institution" | "system" | "admin";

export const TRANSITIONS: Record<ApplicationStatus, Partial<Record<ApplicationStatus, StatusActor[]>>> = {
  INCOMPLETE: { COMPLETED: ["system"], SUBMITTED: ["applicant"] },
  COMPLETED: { INCOMPLETE: ["system"], SUBMITTED: ["applicant"] },
  SUBMITTED: { I_ACKNOWLEDGED: ["institution", "admin"], I_REJECTED: ["institution", "admin"] },
  RESUBMITTED: { I_ACKNOWLEDGED: ["institution", "admin"], I_REJECTED: ["institution", "admin"] },
  I_ACKNOWLEDGED: { ACCEPTED: ["institution", "admin"], I_REJECTED: ["institution", "admin"], RESUBMITTED: ["applicant"] },
  I_REJECTED: { RESUBMITTED: ["applicant"] },
  ACCEPTED: { A_ACKNOWLEDGED: ["applicant"], A_REJECTED: ["applicant"] },
  A_ACKNOWLEDGED: {},
  A_REJECTED: {},
};

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
