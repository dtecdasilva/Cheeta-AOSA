import { ArrowLeft, MapPin, Globe, Calendar } from "lucide-react";
import { InstitutionWithProfile, totalAvailableSpaces, totalProgramCount } from "@/lib/institutionDiscovery/data";

export function InstitutionDetail({
  institution,
  selected,
  onBack,
  onToggleSelect,
  onChoosePrograms,
}: {
  institution: InstitutionWithProfile;
  selected: boolean;
  onBack: () => void;
  onToggleSelect: () => void;
  onChoosePrograms: () => void;
}) {
  const spaces = totalAvailableSpaces(institution.profile);
  const programCount = totalProgramCount(institution.profile);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to browse
      </button>

      <div className="border border-[var(--color-line)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-[var(--color-line-strong)] bg-[var(--color-paper)] font-[var(--font-display)] text-2xl text-[var(--color-ink)]">
              {institution.logoInitial}
            </div>
            <div>
              <p className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">{institution.name}</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{institution.type}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-ink-faint)]">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" strokeWidth={1.75} />
                  {institution.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" strokeWidth={1.75} />
                  Established {institution.profile.establishedYear}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" strokeWidth={1.75} />
                  {institution.profile.website}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onToggleSelect}
            className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
              selected
                ? "border border-[var(--color-brass)] bg-[var(--color-brass-soft)] text-[var(--color-brass-dark)]"
                : "bg-[var(--color-ink)] text-white hover:bg-[var(--color-brass-dark)]"
            }`}
          >
            {selected ? "Selected" : "Select this institution"}
          </button>
        </div>

        {selected && (
          <div className="mt-4">
            <button
              onClick={onChoosePrograms}
              className="inline-flex items-center gap-1.5 border border-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              Choose study programs
            </button>
          </div>
        )}

        <p className="mt-4 max-w-2xl text-sm text-[var(--color-ink-soft)]">{institution.profile.overview}</p>

        <div className="mt-5 grid grid-cols-2 gap-px border border-[var(--color-line)] bg-[var(--color-line)] sm:w-80">
          <div className="bg-white px-4 py-3">
            <p className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">{programCount}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">Programs offered</p>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">{spaces}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">Spaces available</p>
          </div>
        </div>
      </div>

      {/* Faculty → Department → Qualification → Study Program hierarchy */}
      <div className="mt-6 space-y-4">
        {institution.profile.faculties.map((faculty) => (
          <div key={faculty.id} className="border border-[var(--color-line)] bg-white">
            <div className="border-b border-[var(--color-line)] px-5 py-3">
              <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">{faculty.name}</p>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {faculty.departments.map((dept) => (
                <div key={dept.id} className="px-5 py-4">
                  <p className="text-sm font-medium text-[var(--color-ink)]">{dept.name}</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[var(--color-ink-faint)]">
                          <th className="py-1 pr-4 font-normal">Study program</th>
                          <th className="py-1 pr-4 font-normal">Qualification</th>
                          <th className="py-1 font-normal">Spaces available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dept.programs.map((program) => (
                          <tr key={program.id} className="border-t border-[var(--color-line)]">
                            <td className="py-2 pr-4 text-[var(--color-ink)]">{program.name}</td>
                            <td className="py-2 pr-4 text-[var(--color-ink-soft)]">{program.qualification}</td>
                            <td className="py-2 text-[var(--color-ink-soft)]">
                              {program.availableSpaces > 0 ? (
                                program.availableSpaces
                              ) : (
                                <span className="text-[var(--color-danger)]">Full</span>
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
