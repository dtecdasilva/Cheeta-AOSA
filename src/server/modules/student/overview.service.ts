import "server-only";
import type { PublicUser } from "@/lib/auth/users";
import { FINAL_STATUSES } from "@/lib/applications/statusFlow";
import type { ApplicationStatus } from "@/lib/types";
import type { ApplicantProcessProgress, ProcessStepStatus } from "@/lib/processFlow";
import { PROCESS_STEPS } from "@/lib/processFlow";
import { listMyApplicationsInFull } from "@/server/modules/applications/student.service";
import { getMyFees } from "@/server/modules/fees/studentFees.service";
import { getDemographicCompletion, listEducation } from "@/server/modules/student/profile.service";
import { listExaminations, listResults } from "@/server/modules/student/examinations.service";

/**
 * Where the applicant stands, from their real records: what the dashboard,
 * the process flow and the application summary show. Every figure comes
 * from the same services the individual screens use, so the overview and
 * the screens never disagree.
 *
 * The five steps of the process flow:
 *   1. personal, education, examinations and results all recorded
 *   2. at least one institution, each with program choices and every required document
 *   3. every application's fee paid (approved) or awaiting approval
 *   4. every application submitted
 *   5. every application decided (offer answered, or rejected for good)
 */

const NOT_SUBMITTED: ApplicationStatus[] = ["INCOMPLETE", "COMPLETED"];

export interface OverviewAction {
  /** English text with {placeholders}; the screen translates it. */
  label: string;
  values?: Record<string, string>;
  href: string;
}

export async function getMyOverview(user: PublicUser) {
  const [demo, education, exams, results, apps, fees] = await Promise.all([
    getDemographicCompletion(user),
    listEducation(user),
    listExaminations(user),
    listResults(user),
    listMyApplicationsInFull(user),
    getMyFees(user),
  ]);

  const examsWithoutResults = exams.filter((e) => !e.sittings.some((s) => s.resultCount > 0));
  const personal = {
    demographic: demo.completion.status,
    education: education.length,
    examinations: exams.length,
    results: results.length,
    complete: demo.completion.status === "COMPLETE" && education.length > 0 && exams.length > 0 && examsWithoutResults.length === 0,
  };

  const feeById = new Map(fees.applications.map((f) => [f.id, f]));
  const institutions = apps.map((a) => {
    const required = a.requirements.filter((r) => r.required);
    const uploadedRequired = required.filter((r) => a.documents.some((d) => d.requirementId === r.id && d.file)).length;
    const fee = feeById.get(a.id);
    return {
      id: a.id,
      reference: a.reference,
      applicationNumber: a.applicationNumber,
      status: a.status as ApplicationStatus,
      submittedAt: a.submittedAt,
      institution: a.institution,
      choices: a.choices.map((c) => ({ rank: c.rank, program: c.programName, code: c.programCode })),
      maxProgramChoices: a.maxProgramChoices,
      documents: {
        required: required.length,
        uploadedRequired,
        rejected: a.documents.filter((d) => d.reviewStatus === "REJECTED").length,
        items: a.requirements.map((r) => {
          const d = a.documents.find((x) => x.requirementId === r.id && x.file);
          return { name: r.name, required: r.required, status: d ? d.reviewStatus : "NOT_UPLOADED", rejectionReason: d?.rejectionReason ?? null };
        }),
      },
      fee: fee ? { state: fee.state, total: fee.total, currency: fee.currency, bankCode: fee.payment?.bankCode ?? null, reference: fee.payment?.reference ?? null } : null,
      readiness: a.readiness,
      submission: { mode: a.submission.mode, reason: a.submission.reason },
      admission: a.admission ? { number: a.admission.admissionNumber, status: a.admission.status, type: a.admission.type } : null,
    };
  });

  // The five steps.
  const step2 = institutions.length > 0 && institutions.every((i) => !NOT_SUBMITTED.includes(i.status) || (i.choices.length > 0 && i.documents.uploadedRequired === i.documents.required));
  const step3 = institutions.length > 0 && institutions.every((i) => !NOT_SUBMITTED.includes(i.status) || i.fee?.state === "PAID" || i.fee?.state === "AWAITING");
  const step4 = institutions.length > 0 && institutions.every((i) => !NOT_SUBMITTED.includes(i.status));
  const step5 = step4 && institutions.every((i) => FINAL_STATUSES.includes(i.status) || (i.status === "I_REJECTED" && i.submission.mode === null));
  const done = [personal.complete, step2, step3, step4, step5];
  const firstOpen = done.findIndex((d) => !d);
  const currentStepOrder = firstOpen === -1 ? PROCESS_STEPS.length : firstOpen + 1;
  const stepStatus: Record<string, ProcessStepStatus> = {};
  PROCESS_STEPS.forEach((s, i) => (stepStatus[s.key] = done[i] ? "complete" : i + 1 === currentStepOrder ? "current" : "upcoming"));
  const progress: ApplicantProcessProgress = { currentStepOrder, stepStatus };

  // What needs doing, most urgent first.
  const actions: OverviewAction[] = [];
  if (demo.completion.status !== "COMPLETE") actions.push({ label: "Complete your demographic information", href: "/student/application/demographic" });
  if (!education.length) actions.push({ label: "Add your education history", href: "/student/application/education" });
  if (!exams.length) actions.push({ label: "Add the examinations you have sat", href: "/student/application/examinations" });
  else if (examsWithoutResults.length) actions.push({ label: "Record the results of your examinations", href: "/student/application/results" });
  if (!institutions.length) actions.push({ label: "Choose the institutions you want to apply to", href: "/student/institutions/add" });
  for (const i of institutions) {
    const name = { name: i.institution.name };
    if (i.status === "ACCEPTED" && i.admission) actions.push({ label: "Answer the offer of admission from {name}", values: name, href: "/student/application/status" });
    else if (i.submission.mode === "resubmit") actions.push({ label: "Correct and resubmit your application to {name}", values: name, href: "/student/submit/print-submit" });
    else if (NOT_SUBMITTED.includes(i.status)) {
      if (!i.choices.length) actions.push({ label: "Choose your study programs at {name}", values: name, href: "/student/institutions/summary" });
      if (i.documents.uploadedRequired < i.documents.required) actions.push({ label: "Upload the required documents for {name}", values: name, href: "/student/institutions/upload" });
      if (i.fee?.state === "UNPAID" || i.fee?.state === "REJECTED") actions.push({ label: i.fee.state === "REJECTED" ? "Record your payment for {name} again" : "Pay the application fee for {name}", values: name, href: "/student/fees/payment-options" });
      if (i.status === "COMPLETED" && i.submission.mode === "submit") actions.push({ label: "Submit your application to {name}", values: name, href: "/student/submit/print-submit" });
    }
  }

  return {
    personal,
    institutions,
    fees: { currency: fees.baseCurrency, outstanding: fees.totals.outstanding.base, awaiting: fees.totals.awaiting.base, paid: fees.totals.paid.base },
    progress,
    actions,
  };
}

export type MyOverview = Awaited<ReturnType<typeof getMyOverview>>;
