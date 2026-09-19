"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { findApplicationsForInstitution } from "@/lib/mockData/applications";
import { StatusBadge } from "@/components/StatusBadge";
import { Field, TextInput, SelectInput, SecondaryButton } from "@/components/Form";
import { TableFrame, Th, Td, Card } from "@/components/ui";
import { ApplicationStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "COMPLETED", label: "Completed" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "A_ACKNOWLEDGED", label: "Acknowledged by applicant" },
  { value: "I_ACKNOWLEDGED", label: "Acknowledged by institution" },
  { value: "A_REJECTED", label: "Declined by applicant" },
  { value: "I_REJECTED", label: "Rejected by institution" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "RESUBMITTED", label: "Resubmitted" },
];

/** End of the given calendar day, so a "to" filter includes that day. */
function endOfDay(value: string): number {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export default function ApplicationsTable({ institutionId }: { institutionId: string }) {
  const all = useMemo(() => findApplicationsForInstitution(institutionId), [institutionId]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [appId, setAppId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return all.filter((a) => {
      if (status !== "ALL" && a.perInstitutionStatus[institutionId] !== status) return false;
      if (appId && !a.id.toLowerCase().includes(appId.trim().toLowerCase())) return false;
      if (from && new Date(a.createdAt).getTime() < new Date(from).getTime()) return false;
      // Compare against the END of the "to" day — comparing against
      // midnight excluded every application created on that date.
      if (to && new Date(a.createdAt).getTime() > endOfDay(to)) return false;

      if (query) {
        const q = query.trim().toLowerCase();
        const p = a.personalInfo;
        const haystack = [p?.firstName, p?.lastName, p?.email].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [all, status, appId, from, to, query, institutionId]);

  function reset() {
    setQuery("");
    setAppId("");
    setFrom("");
    setTo("");
    setStatus("ALL");
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Applicant name or email">
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search applicants" />
          </Field>
          <Field label="Application ID">
            <TextInput value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="app-1001" />
          </Field>
          <Field label="Created from">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Created to">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Status">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-ink-soft)]">
            Showing {filtered.length} of {all.length} application{all.length === 1 ? "" : "s"}
          </p>
          <SecondaryButton onClick={reset}>Reset filters</SecondaryButton>
        </div>
      </Card>

      <TableFrame>
        <thead>
          <tr>
            <Th className="w-32">Application</Th>
            <Th>Applicant</Th>
            <Th className="w-28">Submitted</Th>
            <Th className="w-48">Status</Th>
            <Th>Programs</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => {
            const status = a.perInstitutionStatus[institutionId];
            return (
              <tr key={a.id}>
                <Td className="text-[var(--color-ink-soft)]">{a.id}</Td>
                <Td>
                  <p className="text-[var(--color-ink)]">
                    {a.personalInfo ? `${a.personalInfo.firstName} ${a.personalInfo.lastName}` : "—"}
                  </p>
                  {a.personalInfo?.email && (
                    <p className="text-xs text-[var(--color-ink-soft)]">{a.personalInfo.email}</p>
                  )}
                </Td>
                <Td className="text-[var(--color-ink-soft)]">{formatDate(a.submittedAt)}</Td>
                <Td>
                  <StatusBadge status={status as ApplicationStatus} />
                </Td>
                <Td className="text-[var(--color-ink-soft)]">
                  {a.programChoices.length ? a.programChoices.map((p) => p.programId).join(", ") : "—"}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/institution/applications/${a.id}`}
                    className="text-sm text-[var(--color-ink)] underline underline-offset-4"
                  >
                    View
                  </Link>
                </Td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <Td colSpan={6} className="py-10 text-center text-sm text-[var(--color-ink-soft)]">
              No applications match these filters.
            </Td>
          )}
        </tbody>
      </TableFrame>
    </div>
  );
}
