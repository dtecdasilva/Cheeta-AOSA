"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { SecondaryButton } from "@/components/Form";
import {
  AdminStatusBadge,
  BarRow,
  ColumnChart,
  DateRangeFilter,
  FilterBar,
  FilterSelect,
  SearchField,
  StatStrip,
} from "@/components/admin/ui";
import { useAdminData } from "@/lib/admin/useAdminData";
import { DATE_PRESETS, describeRange, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { ADMIN_STATUS_LABELS, ALL_STATUSES, STAGES, STATUS_TONE, reachedStages } from "@/lib/admin/status";
import { resetAllAdminData } from "@/lib/admin/store";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const DEFAULT_RANGE = () => DATE_PRESETS.find((p) => p.key === "90")!.range();

export function AdminDashboard() {
  const data = useAdminData();
  const [search, setSearch] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [confirmReset, setConfirmReset] = useState(false);

  const filtersActive = !!(search || institutionId || regionId || typeId || status);

  const view = useMemo(() => {
    const instMatches = (id: string) => {
      const inst = data.institutionById.get(id);
      if (!inst) return false;
      if (institutionId && inst.id !== institutionId) return false;
      if (typeId && inst.typeId !== typeId) return false;
      if (regionId && inst.regionId !== regionId) return false;
      return true;
    };

    const apps = data.applications.filter((a) => {
      if (!inRange(a.createdAt, range)) return false;
      if (!instMatches(a.institutionId)) return false;
      if (status && a.status !== status) return false;
      if (search) {
        const s = data.studentById.get(a.studentId);
        return matchesSearch(search, [a.reference, a.programName, data.institutionName(a.institutionId), s?.firstName, s?.lastName, s?.registrationNo, s?.email]);
      }
      return true;
    });

    const appFilterApplied = !!(institutionId || typeId || status);
    const studentIdsWithMatchingApp = new Set(apps.map((a) => a.studentId));
    const students = data.students.filter((s) => {
      if (!inRange(s.registeredAt, range)) return false;
      if (regionId && !institutionId && !typeId && s.regionId !== regionId) return false;
      if (appFilterApplied && !studentIdsWithMatchingApp.has(s.id)) return false;
      if (search && !matchesSearch(search, [s.firstName, s.lastName, s.registrationNo, s.email, s.phone])) {
        return studentIdsWithMatchingApp.has(s.id);
      }
      return true;
    });
    const studentsWithoutApps = students.filter((s) => !(data.appsByStudent.get(s.id)?.length)).length;

    const institutions = data.institutions.filter(
      (i) =>
        (!institutionId || i.id === institutionId) &&
        (!typeId || i.typeId === typeId) &&
        (!regionId || i.regionId === regionId) &&
        (!search || matchesSearch(search, [i.name, i.accreditationCode, data.label(i.townId)]) || apps.some((a) => a.institutionId === i.id))
    );

    const reached = STAGES.map((s) => ({ ...s, count: 0 }));
    const ever = { submitted: 0, acknowledged: 0, awaitingDecision: 0, awaitingAck: 0, accepted: 0, takenUp: 0, rejected: 0, declined: 0, draft: 0 };
    for (const a of apps) {
      const r = reachedStages(a);
      reached.forEach((s) => r.has(s.key) && (s.count += 1));
      const seen = new Set(a.history.map((h) => h.status));
      if (seen.has("SUBMITTED")) ever.submitted += 1;
      else ever.draft += 1;
      if (seen.has("I_ACKNOWLEDGED")) ever.acknowledged += 1;
      if (a.status === "I_ACKNOWLEDGED") ever.awaitingDecision += 1;
      if (a.status === "SUBMITTED" || a.status === "RESUBMITTED") ever.awaitingAck += 1;
      if (seen.has("ACCEPTED")) ever.accepted += 1;
      if (seen.has("A_ACKNOWLEDGED")) ever.takenUp += 1;
      if (seen.has("I_REJECTED")) ever.rejected += 1;
      if (seen.has("A_REJECTED")) ever.declined += 1;
    }

    // Payments are dated by when they were received, not when the application started.
    const paymentApps = data.applications.filter((a) => a.payment && instMatches(a.institutionId) && (!status || a.status === status));
    const paid = paymentApps.filter((a) => a.payment!.status === "PAID" && inRange(a.payment!.paidAt, range));
    const pending = paymentApps.filter((a) => a.payment!.status === "PENDING" && inRange(a.payment!.initiatedAt, range));
    const collected = paid.reduce((sum, a) => sum + a.payment!.amount, 0);
    const webFees = paid.reduce((sum, a) => sum + a.payment!.webFee, 0);

    const byStatus = ALL_STATUSES.map((s) => ({ status: s, count: apps.filter((a) => a.status === s).length }));

    const perInstitution = institutions
      .map((i) => {
        const list = apps.filter((a) => a.institutionId === i.id);
        const has = (st: string) => list.filter((a) => a.history.some((h) => h.status === st)).length;
        return {
          inst: i,
          total: list.length,
          submitted: has("SUBMITTED"),
          accepted: has("ACCEPTED"),
          rejected: has("I_REJECTED"),
          collected: paid.filter((a) => a.institutionId === i.id).reduce((s, a) => s + a.payment!.amount, 0),
        };
      })
      .filter((r) => r.total > 0 || institutionId)
      .sort((a, b) => b.total - a.total);

    const recent = apps
      .flatMap((a) => a.history.map((h) => ({ app: a, event: h })))
      .filter(({ event }) => inRange(event.at, range))
      .sort((x, y) => y.event.at.localeCompare(x.event.at))
      .slice(0, 8);

    return { apps, students, studentsWithoutApps, institutions, reached, ever, paid, pending, collected, webFees, byStatus, perInstitution, recent };
  }, [data, search, institutionId, regionId, typeId, status, range]);

  const series = useMemo(() => buildSeries(view.apps.map((a) => a.createdAt), range), [view.apps, range]);
  const activeInstitutions = view.institutions.filter((i) => i.status === "ACTIVE").length;
  const started = view.reached[0].count;

  return (
    <>
      <PageHeading
        title="Dashboard"
        description={`Registrations, applications and payments for ${describeRange(range)}.`}
        actions={
          confirmReset ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-ink-soft)]">Discard every change made in the admin portal?</span>
              <SecondaryButton
                type="button"
                onClick={() => {
                  resetAllAdminData();
                  setConfirmReset(false);
                }}
              >
                Reset demo data
              </SecondaryButton>
              <button type="button" onClick={() => setConfirmReset(false)} className="text-[var(--color-ink-soft)] underline underline-offset-4">
                Cancel
              </button>
            </span>
          ) : (
            <SecondaryButton type="button" onClick={() => setConfirmReset(true)}>
              Reset demo data
            </SecondaryButton>
          )
        }
      />

      <FilterBar
        active={filtersActive}
        onClear={() => {
          setSearch("");
          setInstitutionId("");
          setRegionId("");
          setTypeId("");
          setStatus("");
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Student, registration no., application ref., institution" />
        <DateRangeFilter value={range} onChange={setRange} />
        <FilterSelect label="Institution" value={institutionId} onChange={setInstitutionId} options={data.institutionOptions} />
        <FilterSelect label="Institution type" value={typeId} onChange={setTypeId} options={data.options("institution-types")} />
        <FilterSelect label="Region" value={regionId} onChange={setRegionId} options={data.options("regions")} />
        <FilterSelect
          label="Application status"
          value={status}
          onChange={setStatus}
          options={ALL_STATUSES.map((s) => ({ value: s, label: ADMIN_STATUS_LABELS[s] }))}
        />
      </FilterBar>

      <div className="space-y-3">
        <StatStrip
          stats={[
            { label: "Registered students", value: fmt(view.students.length), detail: `${fmt(view.studentsWithoutApps)} yet to apply`, href: "/admin/students/register" },
            { label: "Applications", value: fmt(view.apps.length), detail: `${fmt(view.ever.draft)} not yet submitted`, href: "/admin/applications" },
            { label: "Institutions", value: fmt(activeInstitutions), detail: `active, ${fmt(view.institutions.length - activeInstitutions)} inactive`, href: "/admin/institutions" },
            { label: "Payments received", value: formatCurrency(view.collected), detail: `${fmt(view.paid.length)} payments, ${fmt(view.pending.length)} pending`, href: "/admin/applications?payment=PAID" },
          ]}
        />
        <StatStrip
          stats={[
            { label: "Submitted", value: fmt(view.ever.submitted), detail: `${fmt(view.ever.awaitingAck)} awaiting acknowledgement`, href: "/admin/applications?status=SUBMITTED" },
            { label: "Acknowledged", value: fmt(view.ever.acknowledged), detail: `${fmt(view.ever.awaitingDecision)} awaiting a decision`, href: "/admin/applications?status=I_ACKNOWLEDGED" },
            { label: "Accepted", value: fmt(view.ever.accepted), detail: `${fmt(view.ever.takenUp)} offers taken up`, href: "/admin/applications?status=ACCEPTED" },
            { label: "Rejected", value: fmt(view.ever.rejected), detail: `by institutions, plus ${fmt(view.ever.declined)} offers declined`, href: "/admin/applications?status=I_REJECTED" },
          ]}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
        Application figures count every application started in the date range that has reached that point. Payments are dated
        by when they were received. The region filter matches the institution for applications and payments, and the home
        region for students.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-5">
        <Card padded={false} className="xl:col-span-3">
          <CardHeader title="Application progression" description="How far applications started in this period have got." />
          <div className="px-5 py-3">
            {view.reached.map((s, i) => {
              const prev = i > 0 ? view.reached[i - 1].count : null;
              const conversion = prev ? Math.round((s.count / prev) * 100) : null;
              return (
                <BarRow
                  key={s.key}
                  label={s.label}
                  value={s.count}
                  max={started}
                  tone="ink"
                  detail={conversion !== null ? `${conversion}% of previous` : undefined}
                />
              );
            })}
          </div>
          <div className="border-t border-[var(--color-line)] px-5 py-3 text-right">
            <Link href="/admin/applications/progression" className="text-sm text-[var(--color-ink)] underline underline-offset-4">
              See progression for each application
            </Link>
          </div>
        </Card>

        <Card padded={false} className="xl:col-span-2">
          <CardHeader title="Current status" description="Where each application stands today." />
          <div className="px-5 py-3">
            {view.byStatus.map((s) => (
              <BarRow
                key={s.status}
                label={ADMIN_STATUS_LABELS[s.status]}
                value={s.count}
                max={Math.max(...view.byStatus.map((x) => x.count))}
                tone={STATUS_TONE[s.status]}
                href={`/admin/applications?status=${s.status}`}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card padded={false} className="mt-6">
        <CardHeader title="Applications started" description={series.granularity === "day" ? "Per day" : "Per week, starting Monday"} />
        <div className="px-5 py-5">
          {view.apps.length ? (
            <ColumnChart data={series.points} label="Applications started over time" />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--color-ink-soft)]">No applications match these filters.</p>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <h2 className="mb-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">By institution</h2>
          <TableFrame>
            <thead>
              <tr>
                <Th>Institution</Th>
                <Th className="text-right">Applications</Th>
                <Th className="text-right">Submitted</Th>
                <Th className="text-right">Accepted</Th>
                <Th className="text-right">Rejected</Th>
                <Th className="text-right">Fees received</Th>
              </tr>
            </thead>
            <tbody>
              {view.perInstitution.length === 0 && (
                <tr>
                  <Td colSpan={6} className="py-8 text-center text-[var(--color-ink-soft)]">
                    No institutions have applications for these filters.
                  </Td>
                </tr>
              )}
              {view.perInstitution.slice(0, 10).map((r) => (
                <tr key={r.inst.id}>
                  <Td>
                    <Link href={`/admin/institutions/${r.inst.id}`} className="text-[var(--color-ink)] hover:underline">
                      {r.inst.name}
                    </Link>
                    <p className="text-xs text-[var(--color-ink-faint)]">{data.label(r.inst.typeId)}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{r.total}</Td>
                  <Td className="text-right tabular-nums">{r.submitted}</Td>
                  <Td className="text-right tabular-nums">{r.accepted}</Td>
                  <Td className="text-right tabular-nums">{r.rejected}</Td>
                  <Td className="text-right tabular-nums">{formatCurrency(r.collected)}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          <p className="mt-2 text-xs text-[var(--color-ink-faint)]">Web fees in these payments: {formatCurrency(view.webFees)}.</p>
        </div>

        <div className="xl:col-span-2">
          <h2 className="mb-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">Latest activity</h2>
          <div className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            {view.recent.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-soft)]">Nothing happened in this period.</p>}
            {view.recent.map(({ app, event }) => (
              <Link key={`${app.id}-${event.at}`} href={`/admin/applications/${app.id}`} className="block px-5 py-3 hover:bg-[var(--color-paper)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-[var(--color-ink)]">{data.studentLabel(app.studentId)}</span>
                  <AdminStatusBadge status={event.status} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  {data.institutionName(app.institutionId)}, {formatDateTime(event.at)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-GB");
}

const DAY = 86_400_000;

function buildSeries(dates: string[], range: DateRange) {
  const times = dates.map((d) => new Date(d.slice(0, 10) + "T00:00:00Z").getTime());
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  const start = range.from ? new Date(range.from + "T00:00:00Z").getTime() : times.length ? Math.min(...times) : today;
  const end = range.to ? new Date(range.to + "T00:00:00Z").getTime() : today;
  const spanDays = Math.max(1, Math.round((end - start) / DAY) + 1);
  const granularity: "day" | "week" = spanDays <= 31 ? "day" : "week";

  const bucketStart = (t: number) => {
    if (granularity === "day") return t;
    const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
    return t - dow * DAY;
  };
  const step = granularity === "day" ? DAY : 7 * DAY;
  const counts = new Map<number, number>();
  for (let t = bucketStart(start); t <= end; t += step) counts.set(t, 0);
  for (const t of times) {
    const b = bucketStart(t);
    if (counts.has(b)) counts.set(b, counts.get(b)! + 1);
  }
  const fmtDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const points = [...counts.entries()].map(([t, value]) => {
    const label = fmtDay.format(new Date(t));
    return { label, value, title: `${granularity === "week" ? "Week of " : ""}${label}: ${value} ${value === 1 ? "application" : "applications"}` };
  });
  return { granularity, points };
}
