import Link from "next/link";
import { Check } from "lucide-react";
import { PROCESS_STEPS, ApplicantProcessProgress, statusForStep, ProcessStepStatus } from "@/lib/processFlow";

const STATUS_STYLES: Record<ProcessStepStatus, { node: string; line: string; text: string }> = {
  complete: {
    node: "border-[var(--color-success)] bg-[var(--color-success)] text-white",
    line: "bg-[var(--color-success)]",
    text: "text-[var(--color-ink)]",
  },
  current: {
    node: "border-[var(--color-brass)] bg-white text-[var(--color-brass-dark)] ring-2 ring-[var(--color-brass-soft)]",
    line: "bg-[var(--color-line-strong)]",
    text: "text-[var(--color-ink)]",
  },
  upcoming: {
    node: "border-[var(--color-line-strong)] bg-white text-[var(--color-ink-faint)]",
    line: "bg-[var(--color-line-strong)]",
    text: "text-[var(--color-ink-faint)]",
  },
};

interface ProcessProgressProps {
  progress: ApplicantProcessProgress;
  variant?: "compact" | "detailed";
}

export function ProcessProgress({ progress, variant = "compact" }: ProcessProgressProps) {
  if (variant === "compact") return <CompactProgress progress={progress} />;
  return <DetailedProgress progress={progress} />;
}

function CompactProgress({ progress }: { progress: ApplicantProcessProgress }) {
  return (
    <ol className="flex items-start">
      {PROCESS_STEPS.map((step, i) => {
        const status = statusForStep(progress, step);
        const styles = STATUS_STYLES[status];
        const isLast = i === PROCESS_STEPS.length - 1;
        return (
          <li key={step.key} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${styles.node}`}
                title={step.title}
              >
                {status === "complete" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step.order}
              </span>
              <span className={`mt-2 max-w-[6.5rem] text-center text-[11px] leading-tight ${styles.text}`}>
                {step.shortTitle}
              </span>
            </div>
            {!isLast && <span className={`mx-2 mt-[-1.25rem] h-0.5 flex-1 ${styles.line}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function DetailedProgress({ progress }: { progress: ApplicantProcessProgress }) {
  return (
    <ol className="space-y-0">
      {PROCESS_STEPS.map((step, i) => {
        const status = statusForStep(progress, step);
        const styles = STATUS_STYLES[status];
        const isLast = i === PROCESS_STEPS.length - 1;
        return (
          <li key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${styles.node}`}
              >
                {status === "complete" ? <Check className="h-4.5 w-4.5" strokeWidth={2.5} /> : step.order}
              </span>
              {!isLast && <span className={`w-0.5 flex-1 ${styles.line}`} style={{ minHeight: "2.5rem" }} />}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-8"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className={`font-[var(--font-display)] text-base ${styles.text}`}>
                  Step {step.order}: {step.title}
                </p>
                {status === "current" && (
                  <span className="border border-[var(--color-brass)] bg-[var(--color-brass-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-brass-dark)]">
                    In progress
                  </span>
                )}
                {status === "complete" && (
                  <span className="border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-success)]">
                    Complete
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{step.description}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {step.subItems.map((sub) => (
                  <li key={sub.href}>
                    <Link
                      href={sub.href}
                      className="inline-block border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                    >
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
