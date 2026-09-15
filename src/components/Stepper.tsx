import { Check, Lock } from "lucide-react";
import { StepKey } from "@/lib/types";
import { stepLabels, stepOrder } from "@/lib/data";

export function Stepper({
  steps,
  active,
  onSelect,
}: {
  steps: Record<StepKey, "locked" | "editable" | "submitted">;
  active: StepKey;
  onSelect: (key: StepKey) => void;
}) {
  return (
    <ol className="space-y-1">
      {stepOrder.map((key, i) => {
        const status = steps[key];
        const isActive = key === active;
        const disabled = status === "locked";
        return (
          <li key={key}>
            <button
              disabled={disabled}
              onClick={() => onSelect(key)}
              className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                isActive
                  ? "border-[var(--color-brass)] bg-white text-[var(--color-ink)]"
                  : disabled
                  ? "border-transparent text-[var(--color-ink-faint)]"
                  : "border-transparent text-[var(--color-ink-soft)] hover:bg-white/60"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center border text-xs ${
                  status === "submitted"
                    ? "border-[var(--color-success)] bg-[var(--color-success)] text-white"
                    : disabled
                    ? "border-[var(--color-line-strong)] text-[var(--color-ink-faint)]"
                    : "border-[var(--color-ink)] text-[var(--color-ink)]"
                }`}
              >
                {status === "submitted" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : disabled ? (
                  <Lock className="h-3 w-3" strokeWidth={2} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="flex-1">{stepLabels[key]}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
