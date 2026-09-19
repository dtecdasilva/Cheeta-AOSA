import { MapPin, Check } from "lucide-react";
import { InstitutionWithProfile, totalAvailableSpaces, totalProgramCount } from "@/lib/institutionDiscovery/data";

export function InstitutionCard({
  institution,
  selected,
  onViewDetails,
  onToggleSelect,
}: {
  institution: InstitutionWithProfile;
  selected: boolean;
  onViewDetails: () => void;
  onToggleSelect: () => void;
}) {
  const spaces = totalAvailableSpaces(institution.profile);
  const programCount = totalProgramCount(institution.profile);

  return (
    <div
      className={`flex flex-col border bg-[var(--color-surface)] p-4 transition-colors ${
        selected ? "border-[var(--color-brass)]" : "border-[var(--color-line)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--color-line-strong)] bg-[var(--color-paper)] font-[var(--font-display)] text-lg text-[var(--color-ink)]">
          {institution.logoInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">{institution.name}</p>
          <p className="text-xs text-[var(--color-ink-faint)]">{institution.type}</p>
        </div>
        {selected && <Check className="h-4 w-4 shrink-0 text-[var(--color-brass-dark)]" strokeWidth={2.5} />}
      </div>

      <p className="mt-2 flex items-center gap-1 text-xs text-[var(--color-ink-soft)]">
        <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} />
        {institution.location}
      </p>

      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        {programCount} program{programCount === 1 ? "" : "s"} · {spaces} space{spaces === 1 ? "" : "s"} available
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-line)] pt-3">
        <button
          onClick={onViewDetails}
          className="flex-1 border border-[var(--color-line-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
        >
          View details
        </button>
        <button
          onClick={onToggleSelect}
          className={`flex-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
            selected
              ? "border border-[var(--color-brass)] bg-[var(--color-brass-soft)] text-[var(--color-brass-dark)]"
              : "bg-[var(--color-ink)] text-white hover:bg-[var(--color-brass-dark)]"
          }`}
        >
          {selected ? "Selected" : "Select"}
        </button>
      </div>
    </div>
  );
}
