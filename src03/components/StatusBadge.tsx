import { ApplicationStatus } from "@/lib/types";

const STATUS_META: Record<ApplicationStatus, { label: string; fg: string; bg: string; dot: string }> = {
  INCOMPLETE: { label: "Incomplete", fg: "text-[var(--color-ink-soft)]", bg: "bg-[var(--color-line)]/60", dot: "bg-[var(--color-ink-faint)]" },
  COMPLETED: { label: "Completed", fg: "text-[var(--color-info-strong)]", bg: "bg-[var(--color-info-soft)]", dot: "bg-[var(--color-info)]" },
  SUBMITTED: { label: "Submitted", fg: "text-[var(--color-warning-strong)]", bg: "bg-[var(--color-warning-soft)]", dot: "bg-[var(--color-warning)]" },
  A_ACKNOWLEDGED: { label: "Acknowledged by you", fg: "text-[var(--color-info-strong)]", bg: "bg-[var(--color-info-soft)]", dot: "bg-[var(--color-info)]" },
  I_ACKNOWLEDGED: { label: "Acknowledged by institution", fg: "text-[var(--color-info-strong)]", bg: "bg-[var(--color-info-soft)]", dot: "bg-[var(--color-info)]" },
  A_REJECTED: { label: "Declined by you", fg: "text-[var(--color-danger-strong)]", bg: "bg-[var(--color-danger-soft)]", dot: "bg-[var(--color-danger)]" },
  I_REJECTED: { label: "Rejected by institution", fg: "text-[var(--color-danger-strong)]", bg: "bg-[var(--color-danger-soft)]", dot: "bg-[var(--color-danger)]" },
  ACCEPTED: { label: "Accepted", fg: "text-[var(--color-success-strong)]", bg: "bg-[var(--color-success-soft)]", dot: "bg-[var(--color-success)]" },
  RESUBMITTED: { label: "Resubmitted", fg: "text-[var(--color-warning-strong)]", bg: "bg-[var(--color-warning-soft)]", dot: "bg-[var(--color-warning)]" },
};

const UNKNOWN_META = {
  label: "Not started",
  fg: "text-[var(--color-ink-faint)]",
  bg: "bg-[var(--color-line)]/60",
  dot: "bg-[var(--color-ink-faint)]",
};

/**
 * `status` is typed, but the values reaching this component come from
 * per-institution status maps that may legitimately have no entry for a
 * given institution yet. Looking the metadata up blindly threw on
 * `meta.fg` and took the whole table down with it, so an unrecognised or
 * missing status renders as "Not started" instead.
 */
export function StatusBadge({ status }: { status: ApplicationStatus | undefined | null }) {
  const meta = (status && STATUS_META[status]) || UNKNOWN_META;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta.fg} ${meta.bg}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
