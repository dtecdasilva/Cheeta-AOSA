"use client";

import { Topbar } from "@/components/Topbar";
import { ProcessProgress } from "@/components/ProcessProgress";
import { FormError } from "@/components/Form";
import { useMyOverview } from "@/lib/student/overview";
import { useT } from "@/lib/i18n/client";

/** The five steps, marked from the applicant's own records (GET /api/student/overview). */
export default function ProcessFlowPage() {
  const tr = useT();
  const { data, error } = useMyOverview();

  return (
    <>
      <Topbar
        title={tr("The Process Flow")}
        description={tr("Every application on Cheeta AOSA follows the same five steps, from your first details to tracking a decision.")}
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-3xl rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8">
          {data ? <ProcessProgress progress={data.progress} variant="detailed" /> : error ? <FormError>{error}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>}
        </div>

        <div className="mt-6 max-w-3xl rounded-xl border border-dashed border-[var(--color-line-strong)] px-5 py-4 text-sm text-[var(--color-ink-soft)]">
          {tr("Tap any task above to go straight to it. Each step is marked from your own records, so it moves forward as you complete them.")}
        </div>
      </main>
    </>
  );
}
