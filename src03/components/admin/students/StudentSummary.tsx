"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, DescriptionList, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass } from "@/components/Form";
import {
  AdminStatusBadge,
  DateRangeFilter,
  FilterBar,
  FilterSelect,
  Pager,
  ResultCount,
  SearchField,
  StageTrack,
  StatStrip,
  SubNav,
  STUDENT_NAV,
  ToneBadge,
  usePaged,
} from "@/components/admin/ui";
import { useAdminData } from "@/lib/admin/useAdminData";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { ADMIN_STATUS_LABELS, ALL_STATUSES, STAGES, furthestStage, stageIndex, stageLabel, type StageKey } from "@/lib/admin/status";
import { useHydrated } from "@/lib/admin/store";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export function StudentSummary() {
  const data = useAdminData();
  const [search, setSearch] = useState("");
  const [regionId, setRegionId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const rows = useMemo(
    () =>
      data.students.map((s) => {
        const apps = data.appsByStudent.get(s.id) ?? [];
        const furthest = apps.reduce<StageKey | null>((best, a) => {
          const f = furthestStage(a);
          return best === null || stageIndex(f) > stageIndex(best) ? f : best;
        }, null);
        const latest = [...apps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        return {
          student: s,
          apps,
          furthest,
          latest,
          paid: apps.filter((a) => a.payment?.status === "PAID").reduce((sum, a) => sum + a.payment!.amount, 0),
          lastActivity: latest?.updatedAt ?? s.registeredAt,
          submitted: apps.some((a) => a.history.some((h) => h.status === "SUBMITTED")),
          accepted: apps.some((a) => a.history.some((h) => h.status === "ACCEPTED")),
        };
      }),
    [data]
  );

  const filtered = rows
    .filter(({ student: s, apps, furthest }) => {
      if (!inRange(s.registeredAt, range)) return false;
      if (regionId && s.regionId !== regionId) return false;
      if (institutionId && !apps.some((a) => a.institutionId === institutionId)) return false;
      if (status && !apps.some((a) => a.status === status)) return false;
      if (stage === "none" ? apps.length > 0 : stage && furthest !== stage) return false;
      return matchesSearch(search, [s.firstName, s.lastName, s.registrationNo, s.email, s.phone, ...apps.map((a) => a.reference)]);
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  const { slice, ...pager } = usePaged(filtered, 20);

  return (
    <>
      <SubNav items={STUDENT_NAV} current="/admin/students/summary" />
      <PageHeading title="Student summary" description="Each student with their applications, how far they've got and what they've paid." />

      <FilterBar
        active={!!(search || regionId || institutionId || status || stage || range.from || range.to)}
        onClear={() => {
          setSearch("");
          setRegionId("");
          setInstitutionId("");
          setStatus("");
          setStage("");
          setRange(EMPTY_RANGE);
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Name, registration no., email, application ref." />
        <DateRangeFilter value={range} onChange={setRange} label="Registered" />
        <FilterSelect label="Home region" value={regionId} onChange={setRegionId} options={data.options("regions")} />
        <FilterSelect label="Applied to" value={institutionId} onChange={setInstitutionId} options={data.institutionOptions} allLabel="Any institution" />
        <FilterSelect
          label="Has an application that is"
          value={status}
          onChange={setStatus}
          options={ALL_STATUSES.map((s) => ({ value: s, label: ADMIN_STATUS_LABELS[s] }))}
          allLabel="Any status"
        />
        <FilterSelect
          label="Furthest stage reached"
          value={stage}
          onChange={setStage}
          options={[{ value: "none", label: "No application" }, ...STAGES.map((s) => ({ value: s.key, label: s.label }))]}
          allLabel="Any stage"
        />
      </FilterBar>

      <StatStrip
        stats={[
          { label: "Students", value: filtered.length },
          { label: "With an application", value: filtered.filter((r) => r.apps.length).length },
          { label: "Submitted at least one", value: filtered.filter((r) => r.submitted).length },
          { label: "Accepted at least once", value: filtered.filter((r) => r.accepted).length },
        ]}
      />

      <div className="mt-6">
        <ResultCount shown={filtered.length} total={rows.length} noun="students" />
        {filtered.length === 0 ? (
          <EmptyState message="No students match these filters." />
        ) : (
          <>
            <TableFrame>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th className="text-right">Applications</Th>
                  <Th>Institutions</Th>
                  <Th>Furthest stage</Th>
                  <Th>Latest status</Th>
                  <Th className="text-right">Paid</Th>
                  <Th>Last activity</Th>
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.student.id} className="align-top">
                    <Td>
                      <Link href={`/admin/students/${r.student.id}`} className="font-medium text-[var(--color-ink)] hover:underline">
                        {r.student.firstName} {r.student.lastName}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.student.registrationNo}</p>
                    </Td>
                    <Td className="text-right tabular-nums">{r.apps.length}</Td>
                    <Td className="max-w-[16rem] text-[var(--color-ink-soft)]">
                      {r.apps.length ? r.apps.map((a) => data.institutionName(a.institutionId)).join(", ") : "—"}
                    </Td>
                    <Td className="whitespace-nowrap">{r.furthest ? stageLabel(r.furthest) : <span className="text-[var(--color-ink-faint)]">Not started</span>}</Td>
                    <Td>{r.latest ? <AdminStatusBadge status={r.latest.status} /> : <span className="text-[var(--color-ink-faint)]">—</span>}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{r.paid ? formatCurrency(r.paid) : "—"}</Td>
                    <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">{formatDate(r.lastActivity)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <Pager {...pager} />
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

export function StudentDetail({ id }: { id: string }) {
  const data = useAdminData();
  const hydrated = useHydrated();
  const s = data.studentById.get(id);

  if (!s) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <EmptyState
        message="This student doesn't exist. They may have been registered in another browser."
        action={
          <Link href="/admin/students/summary" className={ButtonLinkClass("secondary")}>
            Back to students
          </Link>
        }
      />
    );
  }

  const apps = [...(data.appsByStudent.get(s.id) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const payments = apps.filter((a) => a.payment);
  const paid = payments.filter((a) => a.payment!.status === "PAID").reduce((sum, a) => sum + a.payment!.amount, 0);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/students/summary" className="text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
          Student summary
        </Link>
      </p>
      <PageHeading title={`${s.firstName} ${s.lastName}`} description={`${s.registrationNo}, registered ${formatDate(s.registeredAt)}`} />

      <StatStrip
        stats={[
          { label: "Applications", value: apps.length },
          { label: "Submitted", value: apps.filter((a) => a.history.some((h) => h.status === "SUBMITTED")).length },
          { label: "Accepted", value: apps.filter((a) => a.history.some((h) => h.status === "ACCEPTED")).length },
          { label: "Paid", value: formatCurrency(paid) },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="self-start">
          <CardHeader title="Profile" />
          <DescriptionList
            items={[
              { label: "Sex", value: s.gender },
              { label: "Date of birth", value: formatDate(s.dateOfBirth) },
              { label: "Email", value: <a href={`mailto:${s.email}`} className="hover:underline">{s.email}</a> },
              { label: "Phone", value: s.phone },
              { label: "Town", value: data.label(s.townId) },
              { label: "Region", value: data.label(s.regionId) },
              { label: "Address", value: s.address || "—" },
              { label: "Highest qualification", value: s.highestQualification || "—" },
              { label: "Registered", value: `${formatDateTime(s.registeredAt)}, ${s.source.toLowerCase()}` },
            ]}
          />
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">Applications</h2>
            {apps.length === 0 ? (
              <EmptyState message="This student hasn't started an application." />
            ) : (
              <div className="space-y-3">
                {apps.map((a) => (
                  <Card key={a.id} padded={false}>
                    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <Link href={`/admin/applications/${a.id}`} className="font-medium text-[var(--color-ink)] underline underline-offset-4">
                          {data.institutionName(a.institutionId)}
                        </Link>
                        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{a.programName}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                          {a.reference}, started {formatDate(a.createdAt)}
                        </p>
                      </div>
                      <AdminStatusBadge status={a.status} />
                    </div>
                    <div className="border-t border-[var(--color-line)] px-5 py-3">
                      <StageTrack app={a} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">Payments</h2>
            {payments.length === 0 ? (
              <EmptyState message="No payments yet." />
            ) : (
              <TableFrame>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Institution</Th>
                    <Th>Method</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((a) => (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap">{a.payment!.reference}</Td>
                      <Td>{data.institutionName(a.institutionId)}</Td>
                      <Td className="text-[var(--color-ink-soft)]">{a.payment!.method}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(a.payment!.amount)}</Td>
                      <Td>
                        <PaymentBadge status={a.payment!.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export function PaymentBadge({ status }: { status: "PAID" | "PENDING" | "FAILED" | null }) {
  if (!status) return <span className="text-sm text-[var(--color-ink-faint)]">Not started</span>;
  return <ToneBadge tone={status === "PAID" ? "success" : status === "PENDING" ? "amber" : "danger"}>{{ PAID: "Paid", PENDING: "Pending", FAILED: "Failed" }[status]}</ToneBadge>;
}
