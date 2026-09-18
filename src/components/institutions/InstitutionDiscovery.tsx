"use client";

import { useMemo, useState } from "react";
import { Search, X, GraduationCap } from "lucide-react";
import { SelectInput } from "@/components/Form";
import { INSTITUTION_TYPES } from "@/lib/data";
import { listInstitutionsWithProfiles, totalAvailableSpaces, ProgramChoice } from "@/lib/institutionDiscovery/data";
import { InstitutionCard } from "./InstitutionCard";
import { InstitutionDetail } from "./InstitutionDetail";
import { StudyProgramSelector } from "./StudyProgramSelector";

// Frontend-only, mock data, per spec: browsing/filtering/selecting all
// happen against listInstitutionsWithProfiles() (src/lib/institutionDiscovery/data.ts)
// and local component state — nothing here calls an API or persists past
// a page refresh. A later module wires "select an institution" into the
// real, database-backed application record.
export function InstitutionDiscovery() {
  const allInstitutions = useMemo(() => listInstitutionsWithProfiles(), []);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [onlyWithSpace, setOnlyWithSpace] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [programSelectionId, setProgramSelectionId] = useState<string | null>(null);
  const [programChoicesByInstitution, setProgramChoicesByInstitution] = useState<
    Record<string, (ProgramChoice | null)[]>
  >({});

  const locations = useMemo(
    () => Array.from(new Set(allInstitutions.map((i) => i.location))).sort(),
    [allInstitutions]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allInstitutions.filter((inst) => {
      if (q && !inst.name.toLowerCase().includes(q)) return false;
      if (typeFilter && inst.type !== typeFilter) return false;
      if (locationFilter && inst.location !== locationFilter) return false;
      if (onlyWithSpace && totalAvailableSpaces(inst.profile) === 0) return false;
      return true;
    });
  }, [allInstitutions, query, typeFilter, locationFilter, onlyWithSpace]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function choicesFor(institutionId: string, slots: number): (ProgramChoice | null)[] {
    return programChoicesByInstitution[institutionId] ?? Array.from({ length: slots }, () => null);
  }

  const viewing = viewingId ? allInstitutions.find((i) => i.id === viewingId) : null;
  const choosingProgramsFor = programSelectionId ? allInstitutions.find((i) => i.id === programSelectionId) : null;

  if (choosingProgramsFor) {
    return (
      <StudyProgramSelector
        institution={choosingProgramsFor}
        choices={choicesFor(choosingProgramsFor.id, choosingProgramsFor.maxProgramChoices)}
        onChange={(next) =>
          setProgramChoicesByInstitution((prev) => ({ ...prev, [choosingProgramsFor.id]: next }))
        }
        onBack={() => setProgramSelectionId(null)}
      />
    );
  }

  if (viewing) {
    return (
      <InstitutionDetail
        institution={viewing}
        selected={selectedIds.includes(viewing.id)}
        onBack={() => setViewingId(null)}
        onToggleSelect={() => toggleSelect(viewing.id)}
        onChoosePrograms={() => setProgramSelectionId(viewing.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected institutions */}
      {selectedIds.length > 0 && (
        <div className="border border-[var(--color-brass)] bg-[var(--color-brass-soft)]/40 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-[var(--color-brass-dark)]">
            {selectedIds.length} institution{selectedIds.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id) => {
              const inst = allInstitutions.find((i) => i.id === id);
              if (!inst) return null;
              const chosen = choicesFor(id, inst.maxProgramChoices).filter((c) => c?.programId).length;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-2 border border-[var(--color-line-strong)] bg-white px-2.5 py-1 text-xs text-[var(--color-ink)]"
                >
                  {inst.name}
                  <button
                    onClick={() => setProgramSelectionId(id)}
                    className="flex items-center gap-1 text-[var(--color-brass-dark)] underline underline-offset-2"
                  >
                    <GraduationCap className="h-3 w-3" strokeWidth={1.75} />
                    {chosen}/{inst.maxProgramChoices} program{inst.maxProgramChoices === 1 ? "" : "s"}
                  </button>
                  <button onClick={() => toggleSelect(id)} aria-label={`Remove ${inst.name}`}>
                    <X className="h-3 w-3 text-[var(--color-ink-faint)] hover:text-[var(--color-danger)]" strokeWidth={2} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="border border-[var(--color-line)] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]"
              strokeWidth={1.75}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search institutions by name…"
              className="w-full border border-[var(--color-line-strong)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-brass)]"
            />
          </div>
          <SelectInput value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All institution types</option>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </SelectInput>
          <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={onlyWithSpace}
              onChange={(e) => setOnlyWithSpace(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brass)]"
            />
            Has space
          </label>
        </div>
      </div>

      {/* Browse grid */}
      {filtered.length === 0 ? (
        <p className="border border-dashed border-[var(--color-line-strong)] px-6 py-14 text-center text-sm text-[var(--color-ink-soft)]">
          No institutions match your search and filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inst) => (
            <InstitutionCard
              key={inst.id}
              institution={inst}
              selected={selectedIds.includes(inst.id)}
              onViewDetails={() => setViewingId(inst.id)}
              onToggleSelect={() => toggleSelect(inst.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
