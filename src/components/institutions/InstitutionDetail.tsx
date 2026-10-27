"use client";

import { ArrowLeft, MapPin, Globe, Mail, Phone } from "lucide-react";
import type { InstitutionDetails } from "@/lib/institutionDiscovery/data";
import { useMoneyFormat } from "@/lib/currency/useCurrencies";
import { useT } from "@/lib/i18n/client";

export function InstitutionDetail({
  institution,
  selected,
  busy,
  canRemove,
  onBack,
  onSelect,
  onRemove,
  onChoosePrograms,
}: {
  institution: InstitutionDetails;
  /** The applicant has already added this institution to their application. */
  selected: boolean;
  busy: boolean;
  /** It can still be taken off the application (not submitted, no payment recorded). */
  canRemove: boolean;
  onBack: () => void;
  onSelect: () => void;
  onRemove: () => void;
  onChoosePrograms: () => void;
}) {
  const tr = useT();
  const format = useMoneyFormat();
  const { programCount, availableSpaces: spaces } = institution;
  const required = institution.requirements.filter((r) => r.required);
  const optional = institution.requirements.filter((r) => !r.required);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        {tr("Back to browse")}
      </button>

      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-paper)] font-bold tracking-tight text-2xl text-[var(--color-ink)]">
              {tr(institution.logoInitial)}
            </div>
            <div>
              <p className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr(institution.name)}</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{tr(institution.type)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-ink-faint)]">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" strokeWidth={1.75} />
                  {[institution.address, institution.location].filter(Boolean).join(" · ")}
                </span>
                {institution.website && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" strokeWidth={1.75} />
                    {tr(institution.website)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" strokeWidth={1.75} />
                  {institution.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" strokeWidth={1.75} />
                  {institution.email}
                </span>
              </div>
            </div>
          </div>

          {selected ? (
            <span className="shrink-0 rounded-lg border border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-4 py-2 text-sm font-medium text-[var(--color-brand-strong)]">{tr("Added to your application")}</span>
          ) : (
            <button
              onClick={onSelect}
              disabled={busy}
              className="shrink-0 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? tr("Adding…") : tr("Select this institution")}
            </button>
          )}
        </div>

        {selected && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={onChoosePrograms}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              {tr("Choose study programs")}
            </button>
            {canRemove && (
              <button onClick={onRemove} disabled={busy} className="text-xs font-medium text-[var(--color-danger)] underline underline-offset-4 disabled:opacity-50">
                {tr("Remove from my application")}
              </button>
            )}
          </div>
        )}

        {institution.accreditation && <p className="mt-4 max-w-2xl text-sm text-[var(--color-ink-soft)]">{tr("Accredited by {accreditation}.", { accreditation: institution.accreditation })}</p>}

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
          <Fact value={String(programCount)} label={tr("Programs offered")} />
          <Fact value={String(spaces)} label={tr("Spaces available")} />
          <Fact value={String(institution.maxProgramChoices)} label={institution.maxProgramChoices === 1 ? tr("Program choice allowed") : tr("Program choices allowed")} />
          <Fact
            value={institution.applicationFee === null ? format(institution.fee.amount, institution.fee.currency) : format(institution.applicationFee + institution.webFee, institution.currency)}
            label={institution.applicationFee === null ? tr("Application fee") : tr("To apply: {value} fee + {value2} web fee", { value: format(institution.applicationFee, institution.currency), value2: format(institution.webFee, institution.currency) })}
          />
        </div>

        {institution.requirements.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium text-[var(--color-ink)]">{tr("Documents you will be asked for")}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {required.map((r) => r.name).join(", ") || tr("None required")}
              {optional.length > 0 && <span className="text-[var(--color-ink-faint)]">{" "}{tr("· Optional:")}{" "}{optional.map((r) => r.name).join(", ")}</span>}
            </p>
          </div>
        )}
      </div>

      {/* Faculty → Department → Qualification → Study Program hierarchy */}
      <div className="mt-6 space-y-4">
        {institution.faculties.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--color-line-strong)] px-6 py-10 text-center text-sm text-[var(--color-ink-soft)]">{tr("This institution hasn't published its study programs yet.")}</p>
        )}
        {institution.faculties.map((faculty) => (
          <div key={faculty.id} className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-line)] px-5 py-3">
              <p className="font-semibold text-base text-[var(--color-ink)]">{tr(faculty.name)}</p>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {faculty.departments.map((dept) => (
                <div key={dept.id} className="px-5 py-4">
                  <p className="text-sm font-medium text-[var(--color-ink)]">{tr(dept.name)}</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[var(--color-ink-faint)]">
                          <th className="py-1 pr-4 font-normal">{tr("Study program")}</th>
                          <th className="py-1 pr-4 font-normal">{tr("Qualification")}</th>
                          <th className="py-1 font-normal">{tr("Spaces available")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dept.programs.map((program) => (
                          <tr key={program.id} className="border-t border-[var(--color-line)]">
                            <td className="py-2 pr-4 text-[var(--color-ink)]">{tr(program.name)}</td>
                            <td className="py-2 pr-4 text-[var(--color-ink-soft)]">{tr(program.qualification)}</td>
                            <td className="py-2 text-[var(--color-ink-soft)]">
                              {program.availableSpaces > 0 ? (
                                program.availableSpaces
                              ) : (
                                <span className="text-[var(--color-danger)]">{tr("Full")}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[var(--color-surface)] px-4 py-3">
      <p className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">{value}</p>
      <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
    </div>
  );
}
