"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import {
  AdminStatusBadge,
  BarRow,
  DateRangeFilter,
  FilterBar,
  FilterSelect,
  Pager,
  ProgressionTimeline,
  ResultCount,
  SearchField,
  StageTrack,
  StatStrip,
  SubNav,
  STUDENT_NAV,
  usePaged,
} from "@/components/admin/ui";
import { useAdminData, type AdminApplication } from "@/lib/admin/useAdminData";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import {
  ADMIN_STATUS_LABELS,
  ALL_STATUSES,
  STAGES,
  STATUS_GROUP,
  STATUS_GROUP_LABELS,
  furthestStage,
  reachedStages,
  stageLabel,
  type StatusGroup,
} from "@/lib/admin/status";
import { formatCurrency, formatDate } from "@/lib/utils";

const GROUPS: StatusGroup[] = ["draft", "awaiting", "acknowledged", "accepted", "rejected", "declined"];

/** Shared filters for the two analysis screens. */
function useScopedApplications() {
  const data = useAdminData();
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [regionId, setRegionId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [institutionId, setInstitutionId] = useState("");

  const apps = useMemo(
    () =>
      data.applications.filter((a) => {
        const inst = data.institutionById.get(a.institutionId);
        return (
          inRange(a.createdAt, range) &&
          (!institutionId || a.institutionId === institutionId) &&
          (!regionId || inst?.regionId === regionId) &&
          (!typeId || inst?.typeId === typeId)
        );
      }),
    [data, range, regionId, typeId, institutionId]
  );

  const active = !!(range.from || range.to || regionId || typeId || institutionId);
  const clear = () => {
    setRange(EMPTY_RANGE);
    setRegionId("");
    setTypeId("");
    setInstitutionId("");
  };
  const controls = (
    <>
      <DateRangeFilter value={range} onChange={setRange} label="Started" />
      <FilterSelect label="Institution" value={institutionId} onChange={setInstitutionId} options={data.institutionOptions} />
      <FilterSelect label="Institution type" value={typeId} onChange={setTypeId} options={data.options("institution-types")} />
      <FilterSelect label="Institution region" value={regionId} onChange={setRegionId} options={data.options("regions")} />
    </>
  );
  return { data, apps, active, clear, controls };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function ApplicationSummary() {
  const { data, apps, active, clear, controls } = useScopedApplications();

  const byInstitution = useMemo(() => {
    const map = new Map<string, { counts: Record<StatusGroup, number>; total: number; paid: number }>();
    for (const a of apps) {
      const row = map.get(a.institutionId) ?? { counts: Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<StatusGroup, number>, total: 0, paid: 0 };
      row.counts[STATUS_GROUP[a.status]] += 1;
      row.total += 1;
      if (a.payment?.status === "PAID") row.paid += a.payment.amount;
      map.set(a.institutionId, row);
    }
    return [...map.entries()].map(([id, row]) => ({ id, ...row })).sort((a, b) => b.total - a.total);
  }, [apps]);

  const totals = GROUPS.reduce((acc, g) => ({ ...acc, [g]: byInstitution.reduce((s, r) => s + r.counts[g], 0) }), {} as Record<StatusGroup, number>);
  const totalPaid = byInstitution.reduce((s, r) => s + r.paid, 0);

  const byProgram = useMemo(() => {
    const map = new Map<string, { program: string; institutionId: string; total: number; accepted: number }>();
    for (const a of apps) {
      const key = `${a.institutionId}|${a.programName}`;
      const row = map.get(key) ?? { program: a.programName, institutionId: a.institutionId, total: 0, accepted: 0 };
      row.total += 1;
      if (a.history.some((h) => h.status === "ACCEPTED")) row.accepted += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [apps]);

  const byStatus = ALL_STATUSES.map((s) => ({ s, n: apps.filter((a) => a.status === s).length }));
  const maxStatus = Math.max(1, ...byStatus.map((x) => x.n));

  return (
    <>
      <SubNav items={STUDENT_NAV} current="/admin/applications/summary" />
      <PageHeading title="Application summary" description="Applications by where they stand, per institution and program." />
      <FilterBar active={active} onClear={clear}>
        {controls}
      </FilterBar>

      <StatStrip
        columns={5}
        stats={[
          { label: "Applications", value: apps.length },
          { label: STATUS_GROUP_LABELS.awaiting, value: totals.awaiting + totals.acknowledged },
          { label: "Accepted", value: totals.accepted },
          { label: "Rejected", value: totals.rejected },
          { label: "Fees received", value: formatCurrency(totalPaid) },
        ]}
      />

      <h2 className="mb-3 mt-8 font-[var(--font-display)] text-xl text-[var(--color-ink)]">By institution</h2>
      {byInstitution.length === 0 ? (
        <EmptyState message="No applications match these filters." />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Institution</Th>
              {GROUPS.map((g) => (
                <Th key={g} className="text-right">
                  {STATUS_GROUP_LABELS[g]}
                </Th>
              ))}
              <Th className="text-right">Total</Th>
              <Th className="text-right">Fees received</Th>
            </tr>
          </thead>
          <tbody>
            {byInstitution.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/admin/applications?institution=${r.id}`} className="text-[var(--color-ink)] hover:underline">
                    {data.institutionName(r.id)}
                  </Link>
                </Td>
                {GROUPS.map((g) => (
                  <Td key={g} className={`text-right tabular-nums ${r.counts[g] ? "" : "text-[var(--color-ink-faint)]"}`}>
                    {r.counts[g]}
                  </Td>
                ))}
                <Td className="text-right font-medium tabular-nums">{r.total}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.paid)}</Td>
              </tr>
            ))}
            <tr className="bg-[var(--color-paper)]">
              <Td className="font-medium">All institutions</Td>
              {GROUPS.map((g) => (
                <Td key={g} className="text-right font-medium tabular-nums">
                  {totals[g]}
                </Td>
              ))}
              <Td className="text-right font-medium tabular-nums">{apps.length}</Td>
              <Td className="whitespace-nowrap text-right font-medium tabular-nums">{formatCurrency(totalPaid)}</Td>
            </tr>
          </tbody>
        </TableFrame>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card padded={false}>
          <CardHeader title="By status" />
          <div className="px-5 py-3">
            {byStatus.map(({ s, n }) => (
              <BarRow key={s} label={ADMIN_STATUS_LABELS[s]} value={n} max={maxStatus} tone={s === "INCOMPLETE" ? "neutral" : undefined} href={`/admin/applications?status=${s}`} />
            ))}
          </div>
        </Card>
        <Card padded={false}>
          <CardHeader title="Most applied-to programs" />
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Program</Th>
                <Th className="text-right">Applications</Th>
                <Th className="text-right">Accepted</Th>
              </tr>
            </thead>
            <tbody>
              {byProgram.map((r) => (
                <tr key={`${r.institutionId}-${r.program}`}>
                  <Td>
                    <p className="text-[var(--color-ink)]">{r.program}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{data.institutionName(r.institutionId)}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{r.total}</Td>
                  <Td className="text-right tabular-nums">{r.accepted}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

function daysBetween(a: AdminApplication, from: string, to: string[]): number | null {
  const start = a.history.find((h) => h.status === from);
  const end = a.history.find((h) => to.includes(h.status));
  if (!start || !end) return null;
  return (new Date(end.at).getTime() - new Date(start.at).getTime()) / 86_400_000;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const WAITS: { label: string; from: string; to: string[] }[] = [
  { label: "Start to submission", from: "INCOMPLETE", to: ["SUBMITTED"] },
  { label: "Submission to acknowledgement", from: "SUBMITTED", to: ["I_ACKNOWLEDGED"] },
  { label: "Acknowledgement to decision", from: "I_ACKNOWLEDGED", to: ["ACCEPTED", "I_REJECTED"] },
  { label: "Offer to applicant's response", from: "ACCEPTED", to: ["A_ACKNOWLEDGED", "A_REJECTED"] },
];

export function ApplicationProgression() {
  const { data, apps, active, clear, controls } = useScopedApplications();
  const [search, setSearch] = useState("");
  const [atStage, setAtStage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const funnel = STAGES.map((s) => ({ ...s, count: apps.filter((a) => reachedStages(a).has(s.key)).length }));
  const waits = WAITS.map((w) => {
    const values = apps.map((a) => daysBetween(a, w.from, w.to)).filter((v): v is number => v !== null);
    return { ...w, median: median(values), n: values.length };
  });

  const list = apps
    .filter((a) => {
      if (atStage && furthestStage(a) !== atStage) return false;
      const s = data.studentById.get(a.studentId);
      return matchesSearch(search, [a.reference, s?.firstName, s?.lastName, s?.registrationNo, data.institutionName(a.institutionId), a.programName]);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { slice, ...pager } = usePaged(list, 15);
  const selected = selectedId ? data.applications.find((a) => a.id === selectedId) : undefined;

  return (
    <>
      <SubNav items={STUDENT_NAV} current="/admin/applications/progression" />
      <PageHeading title="Application progression" description="How applications move from start to decision, and where each one is now." />
      <FilterBar
        active={active || !!search || !!atStage}
        onClear={() => {
          clear();
          setSearch("");
          setAtStage("");
        }}
      >
        {controls}
      </FilterBar>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card padded={false} className="xl:col-span-3">
          <CardHeader title="Stages reached" description="Of the applications in scope, how many got at least this far. Select a stage to list the applications that stopped there." />
          <div className="px-5 py-3">
            {funnel.map((s, i) => {
              const prev = i ? funnel[i - 1].count : 0;
              const stoppedHere = apps.filter((a) => furthestStage(a) === s.key).length;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setAtStage(atStage === s.key ? "" : s.key)}
                  aria-pressed={atStage === s.key}
                  className={`block w-full text-left ${atStage === s.key ? "bg-[var(--color-paper)] outline outline-1 outline-[var(--color-line-strong)]" : ""}`}
                >
                  <BarRow
                    label={s.label}
                    value={s.count}
                    max={funnel[0].count}
                    tone="ink"
                    detail={`${i ? `${prev ? Math.round((s.count / prev) * 100) : 0}% of previous, ` : ""}${stoppedHere} stopped here`}
                  />
                </button>
              );
            })}
          </div>
        </Card>

        <Card padded={false} className="xl:col-span-2">
          <CardHeader title="Typical time between steps" description="Median, in days." />
          <dl className="divide-y divide-[var(--color-line)]">
            {waits.map((w) => (
              <div key={w.label} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-[var(--color-ink-soft)]">
                  {w.label}
                  <span className="block text-xs text-[var(--color-ink-faint)]">from {w.n} applications</span>
                </dt>
                <dd className="font-[var(--font-display)] text-2xl tabular-nums text-[var(--color-ink)]">{w.median === null ? "—" : w.median.toFixed(1)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-5">
        <div className={selected ? "xl:col-span-3" : "xl:col-span-5"}>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <SearchField value={search} onChange={setSearch} placeholder="Reference, student, institution" wide={false} />
            <FilterSelect label="Stopped at" value={atStage} onChange={setAtStage} options={STAGES.map((s) => ({ value: s.key, label: s.label }))} allLabel="Any stage" />
          </div>
          <ResultCount shown={list.length} total={apps.length} noun="applications" />
          {list.length === 0 ? (
            <EmptyState message="No applications match." />
          ) : (
            <>
              <TableFrame>
                <thead>
                  <tr>
                    <Th>Application</Th>
                    <Th>Progress</Th>
                    <Th>Now at</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((a) => (
                    <tr key={a.id} className={`cursor-pointer align-top hover:bg-[var(--color-paper)] ${selectedId === a.id ? "bg-[var(--color-paper)]" : ""}`} onClick={() => setSelectedId(a.id)}>
                      <Td>
                        <button type="button" onClick={() => setSelectedId(a.id)} className="text-left font-medium text-[var(--color-ink)] underline underline-offset-4">
                          {data.studentLabel(a.studentId)}
                        </button>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                          {a.reference}, {data.institutionName(a.institutionId)}
                        </p>
                      </Td>
                      <Td>
                        <StageTrack app={a} compact />
                      </Td>
                      <Td>
                        <p className="text-[var(--color-ink)]">{stageLabel(furthestStage(a))}</p>
                        <div className="mt-1">
                          <AdminStatusBadge status={a.status} />
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">{formatDate(a.updatedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
              <Pager {...pager} />
            </>
          )}
        </div>

        {selected && (
          <aside className="xl:col-span-2">
            <Card padded={false} className="xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">{data.studentLabel(selected.studentId)}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                    {selected.reference}, {data.institutionName(selected.institutionId)}, {selected.programName}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Close progression" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <div className="px-5 py-5">
                <ProgressionTimeline app={selected} institutionName={data.institutionName(selected.institutionId)} />
              </div>
              <div className="border-t border-[var(--color-line)] px-5 py-3 text-right">
                <Link href={`/admin/applications/${selected.id}`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                  Open application
                </Link>
              </div>
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}
