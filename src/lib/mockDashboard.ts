import { institutions } from "./data";
import { ApplicationStatus } from "./types";
import { ApplicantProcessProgress } from "./processFlow";
import { formatCurrency } from "./utils";

/**
 * Realistic stand-in for what the dashboard will show once the modules
 * behind it (institution selection, document upload, payment, submission)
 * are actually built. Shaped exactly like the real data will be — a
 * subset of institutions, a status per institution, a fee total — so
 * swapping this for live data later is a data-source change, not a
 * UI change.
 */
export interface DashboardMockData {
  selectedInstitutionIds: string[];
  perInstitutionStatus: Record<string, ApplicationStatus>;
  totalFees: number;
  totalFeesFormatted: string;
  progress: ApplicantProcessProgress;
  actionsRequired: { label: string; href: string }[];
}

export function getMockDashboardData(): DashboardMockData {
  const selected = institutions.slice(0, 3);
  const selectedInstitutionIds = selected.map((i) => i.id);

  const perInstitutionStatus: Record<string, ApplicationStatus> = {
    [selected[0].id]: "SUBMITTED",
    [selected[1].id]: "COMPLETED",
    [selected[2].id]: "INCOMPLETE",
  };

  const totalFees = selected.reduce((sum, i) => sum + i.applicationFee + i.webFee, 0);

  // Illustrates an applicant partway through Step 2 — Step 1 finished,
  // documents still outstanding for one institution, fees not yet paid.
  const progress: ApplicantProcessProgress = {
    currentStepOrder: 2,
    stepStatus: {
      "personal-education-exams-results": "complete",
      "institutions-programs-uploads": "current",
      "pay-fees": "upcoming",
      "review-submit": "upcoming",
      "track-status": "upcoming",
    },
  };

  const actionsRequired = [
    {
      label: `Upload required documents for ${selected[2].name}`,
      href: "/student/institutions/upload",
    },
    {
      label: "Add a payment method to pay your application fees",
      href: "/student/fees/payment-options",
    },
    {
      label: `Review your submitted application to ${selected[0].name}`,
      href: "/student/application/summary",
    },
  ];

  return {
    selectedInstitutionIds,
    perInstitutionStatus,
    totalFees,
    totalFeesFormatted: formatCurrency(totalFees),
    progress,
    actionsRequired,
  };
}
