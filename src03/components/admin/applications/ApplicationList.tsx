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
  ProgressionTimeline,
  ResultCount,
  SearchField,
  StageTrack,
  SubNav,
  STUDENT_NAV,
  usePaged,
} from "@/components/admin/ui";
import { PaymentBadge } from "@/components/admin/students/StudentSummary";
import { useAdminData } from "@/lib/admin/useAdminData";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { ADMIN_STATUS_LABELS, ALL_STATUSES } from "@/lib/admin/status";
import { useHydrated } from "@/lib/admin/store";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export interface ApplicationFilterDefaults {
  status?: string;
  institution?: string;
  payment?: string;
}

export function ApplicationList({ defaults = {} }: { defaults?: ApplicationFilterDefaults }) {
  const data = useAdminData();
  const [search, setSearch] = useState("");
  const [institutionId, setInstitutionId] = useState(defaults.institution ?? "");
  const [status, setStatus] = useState(defaults.status ?? "");
  const [payment, setPayment] = useState(defaults.payment ?? "");
  const [regionId, setRegionId] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const filtered = useMemo(
    () =>
      data.applications
        .filter((a) => {
          if (!inRange(a.createdAt, range)) return false;
          if (institutionId && a.institutionId !== institutionId) return false;
          if (status && a.status !== status) return false;
          if (payment === "NONE" ? a.payment : payment && a.payment?.status !== payment) return false;
          const s = data.studentById.get(a.studentId);
          if (regionId && s?.regionId !== regionId) return false;
          return matchesSearch(search, [a.reference, a.programName, data.institutionName(a.institutionId), s?.firstName, s?.lastName, s?.registrationNo, s?.email, a.payment?.reference]);
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data, search, institutionId, status, payment, regionId, range]
  );
  const { slice, ...pager } = usePaged(filtered, 20);

  return (
    <>
      <SubNav items={STUDENT_NAV} current="/admin/applications" />
      <PageHeading title="Student applications" description="Every application on the platform, most recently updated first." />

      <FilterBar
        active={!!(search || institutionId || status || payment || regionId || range.from || range.to)}
        onClear={() => {
          setSearch("");
          setInstitutionId("");
          setStatus("");
          setPayment("");
          setRegionId("");
          setRange(EMPTY_RANGE);
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Reference, student, program, payment ref." />
        <DateRangeFilter value={range} onChange={setRange} label="Started" />
        <FilterSelect label="Institution" value={institutionId} onChange={setInstitutionId} options={data.institutionOptions} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={ALL_STATUSES.map((s) => ({ value: s, label: ADMIN_STATUS_LABELS[s] }))} />
        <FilterSelect
          label="Payment"
          value={payment}
          onChange={setPayment}
          options={[
            { value: "PAID", label: "Paid" },
            { value: "PENDING", label: "Pending" },
            { value: "FAILED", label: "Failed" },
            { value: "NONE", label: "Not started" },
          ]}
        />
        <FilterSelect label="Student's region" value={regionId} onChange={setRegionId} options={data.options("regions")} />
      </FilterBar>

      <ResultCount shown={filtered.length} total={data.applications.length} noun="applications" />
      {filtered.length === 0 ? (
        <EmptyState message="No applications match these filters." />
      ) : (
        <>
          <TableFrame>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Student</Th>
                <Th>Institution and program</Th>
                <Th>Started</Th>
                <Th>Payment</Th>
                <Th>Progress</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((a) => {
                const s = data.studentById.get(a.studentId);
                return (
                  <tr key={a.id} className="align-top">
                    <Td className="whitespace-nowrap">
                      <Link href={`/admin/applications/${a.id}`} className="font-medium text-[var(--color-ink)] underline underline-offset-4">
                        {a.reference}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/admin/students/${a.studentId}`} className="text-[var(--color-ink)] hover:underline">
                        {data.studentLabel(a.studentId)}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{s?.registrationNo}</p>
                    </Td>
                    <Td>
                      <p className="text-[var(--color-ink)]">{data.institutionName(a.institutionId)}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{a.programName}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">{formatDate(a.createdAt)}</Td>
                    <Td>
                      <PaymentBadge status={a.payment?.status ?? null} />
                    </Td>
                    <Td>
                      <StageTrack app={a} compact />
                    </Td>
                    <Td>
                      <AdminStatusBadge status={a.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableFrame>
          <Pager {...pager} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

export function ApplicationDetail({ id }: { id: string }) {
  const data = useAdminData();
  const hydrated = useHydrated();
  const app = data.applications.find((a) => a.id === id);

  if (!app) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <EmptyState
        message="This application doesn't exist."
        action={
          <Link href="/admin/applications" className={ButtonLinkClass("secondary")}>
            Back to applications
          </Link>
        }
      />
    );
  }

  const s = data.studentById.get(app.studentId);
  const inst = data.institutionById.get(app.institutionId);
  const submitted = app.history.find((h) => h.status === "SUBMITTED");
  const p = app.payment;
  const daysOpen = Math.max(0, Math.round((new Date(app.updatedAt).getTime() - new Date(app.createdAt).getTime()) / 86_400_000));

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/applications" className="text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
          Student applications
        </Link>
      </p>
      <PageHeading
        title={`Application ${app.reference}`}
        description={`${data.studentLabel(app.studentId)} to ${inst?.name ?? "an unknown institution"}`}
        actions={<AdminStatusBadge status={app.status} />}
      />

      <StageTrack app={app} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader title="Progression" description={`Every step, oldest first. ${daysOpen} ${daysOpen === 1 ? "day" : "days"} from start to latest update.`} />
          <div className="px-5 py-5">
            <ProgressionTimeline app={app} institutionName={inst?.name ?? "Institution"} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card padded={false}>
            <CardHeader title="Application" />
            <DescriptionList
              items={[
                {
                  label: "Student",
                  value: (
                    <Link href={`/admin/students/${app.studentId}`} className="underline underline-offset-4">
                      {data.studentLabel(app.studentId)}
                    </Link>
                  ),
                },
                { label: "Registration no.", value: s?.registrationNo },
                {
                  label: "Institution",
                  value: inst ? (
                    <Link href={`/admin/institutions/${inst.id}`} className="underline underline-offset-4">
                      {inst.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Program", value: app.programName },
                { label: "Started", value: formatDateTime(app.createdAt) },
                { label: "Submitted", value: submitted ? formatDateTime(submitted.at) : "Not yet" },
                { label: "Last update", value: formatDateTime(app.updatedAt) },
              ]}
            />
          </Card>
          <Card padded={false}>
            <CardHeader title="Payment" />
            {p ? (
              <DescriptionList
                items={[
                  { label: "Status", value: <PaymentBadge status={p.status} /> },
                  { label: "Reference", value: p.reference },
                  { label: "Method", value: p.method },
                  { label: "Application fee", value: formatCurrency(p.applicationFee) },
                  { label: "Web fee", value: formatCurrency(p.webFee) },
                  { label: "Total", value: formatCurrency(p.amount) },
                  { label: p.paidAt ? "Received" : "Started", value: formatDateTime(p.paidAt ?? p.initiatedAt) },
                ]}
              />
            ) : (
              <p className="px-5 py-4 text-sm text-[var(--color-ink-soft)]">The applicant hasn&apos;t started paying yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
