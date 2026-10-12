"use client";

import { MapPin, Check } from "lucide-react";
import type { InstitutionListing } from "@/lib/institutionDiscovery/data";
import { useMoneyFormat } from "@/lib/currency/useCurrencies";

export function InstitutionCard({
  institution,
  selected,
  busy,
  onViewDetails,
  onSelect,
}: {
  institution: InstitutionListing;
  /** The applicant has already added this institution to their application. */
  selected: boolean;
  busy: boolean;
  onViewDetails: () => void;
  onSelect: () => void;
}) {
  const format = useMoneyFormat();
  const { programCount, availableSpaces: spaces } = institution;

  return (
    <div
      className={`flex flex-col rounded-xl border bg-[var(--color-surface)] p-4 transition-colors ${
        selected ? "border-[var(--color-brand)]" : "border-[var(--color-line)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-paper)] font-semibold tracking-tight text-lg text-[var(--color-ink)]">
          {institution.logoInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">{institution.name}</p>
          <p className="text-xs text-[var(--color-ink-faint)]">{institution.type}</p>
        </div>
        {selected && <Check className="h-4 w-4 shrink-0 text-[var(--color-brand-strong)]" strokeWidth={2.5} />}
      </div>

      <p className="mt-2 flex items-center gap-1 text-xs text-[var(--color-ink-soft)]">
        <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} />
        {institution.location}
      </p>

      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        {programCount} program{programCount === 1 ? "" : "s"} · {spaces} space{spaces === 1 ? "" : "s"} available
      </p>
      <p className="mt-1 flex-1 text-xs text-[var(--color-ink-soft)]">
        {institution.applicationFee === null
          ? `Application fee ${format(institution.fee.amount, institution.fee.currency)}`
          : `Application fee ${format(institution.applicationFee, institution.currency)} + web fee ${format(institution.webFee, institution.currency)}`}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-line)] pt-3">
        <button
          onClick={onViewDetails}
          className="flex-1 rounded-lg border border-[var(--color-line-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
        >
          View details
        </button>
        {selected ? (
          <span className="flex-1 rounded-lg border border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-2.5 py-1.5 text-center text-xs font-medium text-[var(--color-brand-strong)]">Added</span>
        ) : (
          <button
            onClick={onSelect}
            disabled={busy}
            className="flex-1 rounded-lg bg-[var(--color-brand)] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Adding…" : "Select"}
          </button>
        )}
      </div>
    </div>
  );
}
