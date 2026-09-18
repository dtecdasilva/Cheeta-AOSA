"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Topbar } from "@/components/Topbar";
import { Stepper } from "@/components/Stepper";
import { StatusBadge } from "@/components/StatusBadge";
import { institutions, stepLabels, stepOrder } from "@/lib/data";
import { StepKey } from "@/lib/types";
import { PersonalStep } from "@/components/steps/PersonalStep";
import { EducationStep } from "@/components/steps/EducationStep";
import { ExaminationStep } from "@/components/steps/ExaminationStep";
import { InstitutionsStep } from "@/components/steps/InstitutionsStep";
import { DocumentsStep } from "@/components/steps/DocumentsStep";
import { FeesStep } from "@/components/steps/FeesStep";
import { ReviewStep } from "@/components/steps/ReviewStep";

export default function ApplicationWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getApplication, updateStepDraft, submitStep, submitApplication } = useApp();
  const router = useRouter();
  const application = getApplication(id);

  const firstOpenStep = application
    ? stepOrder.find((k) => application.steps[k] !== "submitted") ?? "review"
    : "personal";
  const [active, setActive] = useState<StepKey>(firstOpenStep);

  if (!application) {
    return (
      <>
        <Topbar title="Application not found" />
        <main className="px-8 py-8">
          <p className="text-sm text-[var(--color-ink-soft)]">
            This application doesn&apos;t exist or has been removed.{" "}
            <button onClick={() => router.push("/student/applications")} className="underline underline-offset-4">
              Back to applications
            </button>
          </p>
        </main>
      </>
    );
  }

  const editable = application.steps[active] !== "submitted" && application.steps[active] !== "locked";

  return (
    <>
      <Topbar
        title="Application"
        description={application.institutionIds.map((i) => institutions.find((x) => x.id === i)?.name).join(", ")}
      />
      <main className="flex gap-8 px-8 py-8">
        <div className="w-72 shrink-0">
          <div className="mb-4 flex items-center justify-between border border-[var(--color-line)] bg-white px-4 py-3">
            <span className="text-xs text-[var(--color-ink-soft)]">Overall status</span>
            <StatusBadge status={application.overallStatus} />
          </div>
          <div className="border border-[var(--color-line)] bg-[var(--color-paper)] py-2">
            <Stepper steps={application.steps} active={active} onSelect={setActive} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="mb-5 font-[var(--font-display)] text-xl text-[var(--color-ink)]">{stepLabels[active]}</h2>

          {active === "personal" && (
            <PersonalStep
              application={application}
              editable={editable}
              onSave={(info) => updateStepDraft(application.id, "personal", { personalInfo: info })}
              onSubmit={() => submitStep(application.id, "personal")}
            />
          )}

          {active === "education" && (
            <EducationStep
              records={application.education}
              editable={editable}
              onSave={(records) => updateStepDraft(application.id, "education", { education: records })}
              onSubmit={() => submitStep(application.id, "education")}
            />
          )}

          {active === "examination" && (
            <ExaminationStep
              records={application.examinations}
              editable={editable}
              onSave={(records) => updateStepDraft(application.id, "examination", { examinations: records })}
              onSubmit={() => submitStep(application.id, "examination")}
            />
          )}

          {active === "institutions" && (
            <InstitutionsStep
              institutionIds={application.institutionIds}
              choices={application.programChoices}
              editable={editable}
              onSave={(choices) => updateStepDraft(application.id, "institutions", { programChoices: choices })}
              onSubmit={() => submitStep(application.id, "institutions")}
            />
          )}

          {active === "documents" && (
            <DocumentsStep
              institutionIds={application.institutionIds}
              documents={application.documents}
              editable={editable}
              onSave={(documents) => updateStepDraft(application.id, "documents", { documents })}
              onSubmit={() => submitStep(application.id, "documents")}
            />
          )}

          {active === "fees" && (
            <FeesStep
              institutionIds={application.institutionIds}
              payment={application.payment}
              editable={editable}
              onSave={(payment) => updateStepDraft(application.id, "fees", { payment })}
              onSubmit={() => submitStep(application.id, "fees")}
            />
          )}

          {active === "review" && (
            <ReviewStep
              application={application}
              onFinalSubmit={() => {
                submitApplication(application.id);
                router.push(`/student/applications/${application.id}/submitted`);
              }}
            />
          )}
        </div>
      </main>
    </>
  );
}
