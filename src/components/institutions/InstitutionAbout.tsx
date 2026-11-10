"use client";

import { useEffect, useRef } from "react";
import { Building2, ExternalLink, GraduationCap, Layers, MapPin, Users, X } from "lucide-react";
import type { InstitutionListing } from "@/lib/institutionDiscovery/data";
import { formatWindowDateTime } from "@/lib/institution/applicationWindow";
import { useT } from "@/lib/i18n/client";
import { InstitutionLogo } from "./InstitutionLogo";

/** A website address as given, only if it is a web address: it becomes a link, so nothing else is allowed through. */
const webAddress = (value: string) => (/^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null);

/**
 * A pop-up about one institution: who it is (logo, motto, a short
 * description), how big it is (faculties, departments, programs, spaces),
 * where to find it, and when it takes applications. It uses only the
 * listing the page already has, so it opens at once. The full programs and
 * documents are on the details page, one click away.
 */
export function InstitutionAbout({ institution, open, onClose, onViewDetails }: { institution: InstitutionListing; open: boolean; onClose: () => void; onViewDetails: () => void }) {
  const tr = useT();
  const dialog = useRef<HTMLDialogElement>(null);

  // The browser's own modal: it keeps the keyboard inside, closes on Escape and dims the page behind.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const site = webAddress(institution.website);
  const w = institution.applications;
  const titleId = `about-${institution.id}`;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dimmed area (the dialog element itself, outside its content) closes it.
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto max-h-[88vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-0 text-[var(--color-ink)] shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <div className="max-h-[88vh] overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <InstitutionLogo url={institution.logoUrl} initial={institution.logoInitial} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-semibold tracking-tight text-xl">
                {tr(institution.name)}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{tr(institution.type)}</p>
              {institution.motto && <p className="mt-2 text-sm italic text-[var(--color-ink)]">“{institution.motto}”</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={tr("Close")} className="-mr-1 -mt-1 rounded-lg p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>

          {institution.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-soft)]">{institution.description}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
            <Fact icon={Building2} value={institution.facultyCount} label={institution.facultyCount === 1 ? tr("Faculty / School") : tr("Faculties / Schools")} />
            <Fact icon={Layers} value={institution.departmentCount} label={institution.departmentCount === 1 ? tr("Department") : tr("Departments")} />
            <Fact icon={GraduationCap} value={institution.programCount} label={institution.programCount === 1 ? tr("Study program") : tr("Study programs")} />
            <Fact icon={Users} value={institution.availableSpaces} label={tr("Spaces available")} />
          </dl>

          <ul className="mt-5 space-y-2.5 text-sm">
            {institution.location && (
              <li className="flex items-start gap-2 text-[var(--color-ink-soft)]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>{tr(institution.location)}</span>
              </li>
            )}
            {site && (
              <li className="flex items-start gap-2">
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-soft)]" strokeWidth={1.75} aria-hidden />
                <a href={site} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--color-ink)] underline underline-offset-4">
                  {site.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                  <span className="sr-only"> {tr("(opens in a new tab)")}</span>
                </a>
              </li>
            )}
          </ul>

          {w && (
            <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-sm">
              <p className="font-medium text-[var(--color-ink)]">{tr("Applications")}</p>
              <p className={`mt-0.5 ${w.open ? "text-[var(--color-success-strong)]" : "text-[var(--color-ink-soft)]"}`}>{tr(w.label)}</p>
              {(w.opensAt || w.closesAt) && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[var(--color-ink-soft)]">
                  {w.opensAt && (
                    <>
                      <dt>{tr("Opens")}</dt>
                      <dd className="text-[var(--color-ink)]">{formatWindowDateTime(w.opensAt)}</dd>
                    </>
                  )}
                  {w.closesAt && (
                    <>
                      <dt>{tr("Closes")}</dt>
                      <dd className="text-[var(--color-ink)]">{formatWindowDateTime(w.closesAt)}</dd>
                    </>
                  )}
                </dl>
              )}
              {!w.open && w.message && <p className="mt-2 text-[var(--color-ink-soft)]">{w.message}</p>}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-line-strong)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)]">
              {tr("Close")}
            </button>
            <button type="button" onClick={onViewDetails} className="rounded-lg bg-[var(--color-brand)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)]">
              {tr("See programs and requirements")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function Fact({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>; value: number; label: string }) {
  return (
    <div className="bg-[var(--color-surface)] px-3 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-semibold tracking-tight text-xl text-[var(--color-ink)]">{value.toLocaleString("en-GB")}</dd>
    </div>
  );
}
