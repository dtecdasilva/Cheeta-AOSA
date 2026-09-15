export type ProcessStepStatus = "complete" | "current" | "upcoming";

export interface ProcessStep {
  key: string;
  order: number;
  title: string;
  shortTitle: string;
  description: string;
  /** Named sub-tasks that make up this step, matching the nav's information
   * architecture (e.g. "Demographic Information" lives inside Step 1). */
  subItems: { label: string; href: string }[];
}

/**
 * The five-step process exactly as specified. Sub-item hrefs point at the
 * nav locations those tasks will live at once each module is built — most
 * are placeholders today (see the nav config), but the links are real so
 * this component stays correct as those modules land.
 */
export const PROCESS_STEPS: ProcessStep[] = [
  {
    key: "personal-education-exams-results",
    order: 1,
    title: "Personal, Education, Examinations & Results",
    shortTitle: "Personal & academic history",
    description:
      "Your demographic details, education history, examinations sat and results obtained.",
    subItems: [
      { label: "Demographic Information", href: "/student/application/demographic" },
      { label: "Education Information", href: "/student/application/education" },
      { label: "Examinations Information", href: "/student/application/examinations" },
      { label: "Results Information", href: "/student/application/results" },
    ],
  },
  {
    key: "institutions-programs-uploads",
    order: 2,
    title: "Select Institutions, Study Programs & Upload Requirements",
    shortTitle: "Institutions & programs",
    description:
      "Choose the institutions you're applying to, the study programs at each, and upload every institution-specific document they require.",
    subItems: [
      { label: "Institution Summary", href: "/student/institutions/summary" },
      { label: "Add Institution", href: "/student/institutions/add" },
      { label: "Institution Upload", href: "/student/institutions/upload" },
    ],
  },
  {
    key: "pay-fees",
    order: 3,
    title: "Pay Application Fees",
    shortTitle: "Pay application fees",
    description: "Review what's owed per institution and submit payment through a supported method.",
    subItems: [
      { label: "Application Fee Summary", href: "/student/fees/summary" },
      { label: "View Payment Options", href: "/student/fees/payment-options" },
    ],
  },
  {
    key: "review-submit",
    order: 4,
    title: "Review and Submit Applications",
    shortTitle: "Review & submit",
    description: "Check every section for accuracy, then submit your application to each selected institution.",
    subItems: [{ label: "Print/Submit My Application", href: "/student/submit/print-submit" }],
  },
  {
    key: "track-status",
    order: 5,
    title: "Track Application Status",
    shortTitle: "Track status",
    description: "Follow verification, deliberation and admission decisions as each institution processes your file.",
    subItems: [{ label: "Application Summary", href: "/student/application/summary" }],
  },
];

export interface ApplicantProcessProgress {
  currentStepOrder: number;
  stepStatus: Record<string, ProcessStepStatus>;
}

export function statusForStep(progress: ApplicantProcessProgress, step: ProcessStep): ProcessStepStatus {
  return progress.stepStatus[step.key] ?? (step.order < progress.currentStepOrder ? "complete" : "upcoming");
}
