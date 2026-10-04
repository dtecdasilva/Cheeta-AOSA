import { ApplicationStatus } from "@/lib/types";
import { mockApplications } from "./applications";
import { mockDocumentStates } from "./institutions";

export interface InstitutionPortalCounts {
  applications: number;
  pending: number;
  paymentVerification: number;
  uploadVerification: number;
  acknowledged: number;
  rejected: number;
  deliberation: number;
  accepted: number;
}

export const EMPTY_PORTAL_COUNTS: InstitutionPortalCounts = {
  applications: 0,
  pending: 0,
  paymentVerification: 0,
  uploadVerification: 0,
  acknowledged: 0,
  rejected: 0,
  deliberation: 0,
  accepted: 0,
};

/** Statuses that mean "received but not yet decided on". */
const PENDING_STATUSES: ApplicationStatus[] = ["SUBMITTED", "RESUBMITTED", "I_ACKNOWLEDGED"];

/**
 * Derived from the same `mockApplications` the Student Applications table
 * reads, rather than being typed out separately. Hard-coded counts let the
 * dashboard claim 42 applications while the table listed three — computing
 * them means the two screens can never disagree.
 */
export function getInstitutionPortalCounts(institutionId: string): InstitutionPortalCounts {
  const apps = mockApplications.filter((a) => a.institutionIds.includes(institutionId));
  const statusOf = (a: (typeof apps)[number]) => a.perInstitutionStatus[institutionId];

  const countBy = (predicate: (s: ApplicationStatus | undefined) => boolean) =>
    apps.filter((a) => predicate(statusOf(a))).length;

  return {
    applications: apps.length,
    pending: countBy((s) => !!s && PENDING_STATUSES.includes(s)),
    // Submitted, but with no payment recorded yet.
    paymentVerification: apps.filter((a) => statusOf(a) !== "INCOMPLETE" && !a.payment).length,
    // Has at least one document still awaiting, missing or failing review.
    uploadVerification: apps.filter((a) =>
      a.documents.some((d) => {
        const state = mockDocumentStates[d.id]?.status;
        return state === "PENDING" || state === "REJECTED" || state === "NOT_UPLOADED";
      })
    ).length,
    acknowledged: countBy((s) => s === "I_ACKNOWLEDGED" || s === "A_ACKNOWLEDGED"),
    rejected: countBy((s) => s === "I_REJECTED" || s === "A_REJECTED"),
    deliberation: countBy((s) => s === "I_ACKNOWLEDGED"),
    accepted: countBy((s) => s === "ACCEPTED"),
  };
}
