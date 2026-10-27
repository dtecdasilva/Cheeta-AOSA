"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, GraduationCap } from "lucide-react";
import { FormError, SelectInput } from "@/components/Form";
import { useMyApplications, type MyApplication } from "@/lib/applications/api";
import type { InstitutionDetails, InstitutionListing } from "@/lib/institutionDiscovery/data";
import { InstitutionCard } from "./InstitutionCard";
import { InstitutionDetail } from "./InstitutionDetail";
import { StudyProgramSelector } from "./StudyProgramSelector";
import { useT } from "@/lib/i18n/client";

/**
 * Add Institution: browse the institutions accepting applications, add
 * one to the application, and choose study programs there.
 *
 * Everything is the database's. The list and each institution's details
 * come from /api/reference/institutions; adding one, removing one and
 * saving program choices go through /api/student/applications and are
 * saved at once. So an institution added here is the same one the
 * Institution Summary, Institution Upload and fee pages then show.
 *
 * `institution` and `view` open the page on one institution (its details
 * or its program choices), as the Institution Summary links here.
 */
export function InstitutionDiscovery({ institution: initialId, view: initialView }: { institution?: string; view?: string }) {
  const tr = useT();
  const [listings, setListings] = useState<InstitutionListing[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const mine = useMyApplications();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [onlyWithSpace, setOnlyWithSpace] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(initialId && initialView !== "programs" ? initialId : null);
  const [programSelectionId, setProgramSelectionId] = useState<string | null>(initialId && initialView === "programs" ? initialId : null);
  const [details, setDetails] = useState<Record<string, InstitutionDetails>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; institutionId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reference/institutions", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setListings(body.data);
        else setListError(body.error ?? tr("The institutions could not be loaded."));
      })
      .catch(() => !cancelled && setListError(tr("The institutions could not be loaded. Check your connection.")));
    return () => {
      cancelled = true;
    };
  }, []);

  // Details are fetched when an institution is opened, and kept for the visit.
  const openId = programSelectionId ?? viewingId;
  useEffect(() => {
    if (!openId || details[openId]) return;
    let cancelled = false;
    fetch(`/api/reference/institutions/${encodeURIComponent(openId)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setDetails((d) => ({ ...d, [openId]: body.data }));
        else {
          setProblem(body.error ?? tr("This institution could not be loaded."));
          setViewingId(null);
          setProgramSelectionId(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProblem(tr("This institution could not be loaded. Check your connection."));
        setViewingId(null);
        setProgramSelectionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [openId, details]);

  const applications = useMemo(() => mine.applications ?? [], [mine.applications]);
  const applicationFor = (institutionId: string): MyApplication | undefined => applications.find((a) => a.institution.id === institutionId);

  const all = useMemo(() => listings ?? [], [listings]);
  const types = useMemo(() => Array.from(new Set(all.map((i) => i.type).filter(Boolean))).sort(), [all]);
  const locations = useMemo(() => Array.from(new Set(all.map((i) => i.location).filter(Boolean))).sort(), [all]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((inst) => {
      if (q && !inst.name.toLowerCase().includes(q)) return false;
      if (typeFilter && inst.type !== typeFilter) return false;
      if (locationFilter && inst.location !== locationFilter) return false;
      if (onlyWithSpace && inst.availableSpaces === 0) return false;
      return true;
    });
  }, [all, query, typeFilter, locationFilter, onlyWithSpace]);

  async function select(inst: InstitutionListing) {
    if (busyId) return;
    setProblem(null);
    setNotice(null);
    setBusyId(inst.id);
    const result = await mine.add(inst.id);
    setBusyId(null);
    if (result.ok) setNotice({ text: tr("{name} added to your application.", { name: tr(inst.name) }), institutionId: inst.id });
    else setProblem(result.error);
  }

  async function remove(application: MyApplication) {
    if (busyId) return;
    if (!window.confirm(tr("Remove {name} from your application? Its program choices and uploaded documents will be removed too.", { name: tr(application.institution.name) }))) return;
    setProblem(null);
    setNotice(null);
    setBusyId(application.institution.id);
    const result = await mine.remove(application.id);
    setBusyId(null);
    if (!result.ok) setProblem(result.error);
  }

  const loadError = listError ?? mine.error;
  if (!listings || !mine.applications) {
    return loadError ? <FormError>{tr(loadError)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading institutions…")}</p>;
  }

  if (programSelectionId) {
    const institution = details[programSelectionId];
    const application = applicationFor(programSelectionId);
    if (!institution) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
    if (!application) {
      // Programs are chosen on an application, so the institution has to be added first.
      return (
        <div className="space-y-4">
          <FormError>{tr("Add {name} to your application before choosing study programs there.", { name: tr(institution.name) })}</FormError>
          <button onClick={() => (setProgramSelectionId(null), setViewingId(institution.id))} className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
            {tr("View {name}", { name: tr(institution.name) })}
          </button>
        </div>
      );
    }
    return (
      <StudyProgramSelector
        // A fresh selector per application, starting from what is saved.
        key={application.id}
        institution={institution}
        saved={application.choices.map((c) => c.programId)}
        editable={application.canEdit}
        onSave={(programIds) => mine.setChoices(application.id, programIds)}
        onBack={() => setProgramSelectionId(null)}
      />
    );
  }

  if (viewingId) {
    const institution = details[viewingId];
    const application = applicationFor(viewingId);
    if (!institution) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
    return (
      <div className="space-y-4">
        {problem && <FormError>{tr(problem)}</FormError>}
        <InstitutionDetail
          institution={institution}
          selected={!!application}
          busy={busyId === institution.id}
          canRemove={!!application?.canEdit}
          onBack={() => (setViewingId(null), setProblem(null))}
          onSelect={() => select(institution)}
          onRemove={() => application && remove(application)}
          onChoosePrograms={() => setProgramSelectionId(institution.id)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {problem && <FormError>{tr(problem)}</FormError>}
      {notice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success-strong)]">
          <span>{tr("{text} Next, choose the study programs you want there.", { text: notice.text })}</span>
          <button onClick={() => (setProgramSelectionId(notice.institutionId), setNotice(null))} className="font-semibold underline underline-offset-4">
            {tr("Choose study programs")}
          </button>
        </div>
      )}

      {/* The institutions already on the application */}
      {applications.length > 0 && (
        <div className="rounded-lg border border-[var(--color-brand)] bg-[var(--color-brand-soft)]/40 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--color-brand-strong)]">
              {tr("{count} institution", { count: applications.length })}{applications.length === 1 ? "" : "s"}{" "}{tr("on your application")}
            </p>
            <Link href="/student/institutions/summary" className="text-xs font-medium text-[var(--color-brand-strong)] underline underline-offset-2">
              {tr("Institution summary")}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {applications.map((application) => (
              <span
                key={application.id}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink)]"
              >
                {tr(application.institution.name)}
                <button
                  onClick={() => setProgramSelectionId(application.institution.id)}
                  className="flex items-center gap-1 text-[var(--color-brand-strong)] underline underline-offset-2"
                >
                  <GraduationCap className="h-3 w-3" strokeWidth={1.75} />
                  {tr("{count}/{maxProgramChoices} program", { count: application.choices.length, maxProgramChoices: application.maxProgramChoices })}{application.maxProgramChoices === 1 ? "" : "s"}
                </button>
                {application.canEdit && (
                  <button onClick={() => remove(application)} disabled={busyId !== null} aria-label={tr("Remove {name}", { name: tr(application.institution.name) })}>
                    <X className="h-3 w-3 text-[var(--color-ink-faint)] hover:text-[var(--color-danger)]" strokeWidth={2} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]"
              strokeWidth={1.75}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Search institutions by name…")}
              aria-label={tr("Search institutions by name")}
              className="w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/25"
            />
          </div>
          <SelectInput value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label={tr("Institution type")}>
            <option value="">{tr("All institution types")}</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {tr(t)}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} aria-label={tr("Location")}>
            <option value="">{tr("All locations")}</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {tr(l)}
              </option>
            ))}
          </SelectInput>
          <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={onlyWithSpace}
              onChange={(e) => setOnlyWithSpace(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            {tr("Has space")}
          </label>
        </div>
      </div>

      {/* Browse grid */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-line-strong)] px-6 py-14 text-center text-sm text-[var(--color-ink-soft)]">
          {all.length === 0 ? tr("No institutions are accepting applications at the moment.") : tr("No institutions match your search and filters.")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inst) => (
            <InstitutionCard
              key={inst.id}
              institution={inst}
              selected={!!applicationFor(inst.id)}
              busy={busyId === inst.id}
              onViewDetails={() => (setProblem(null), setViewingId(inst.id))}
              onSelect={() => select(inst)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
