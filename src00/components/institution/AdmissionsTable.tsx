"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { findAdmissionsForInstitution } from "@/lib/mockData/admissions";
import { TableFrame, Th, Td, Card } from "@/components/ui";
import { Field, TextInput, SelectInput, SecondaryButton } from "@/components/Form";

const STATUS_OPTIONS = ["ALL", "OFFERED", "ACCEPTED", "REJECTED", "PENDING"] as const;

export default function AdmissionsTable({ institutionId }: { institutionId: string }) {
  const all = useMemo(() => findAdmissionsForInstitution(institutionId), [institutionId]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<typeof STATUS_OPTIONS[number]>("ALL");
  const [appId, setAppId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (appId && !r.applicationId.toLowerCase().includes(appId.trim().toLowerCase())) return false;
      if (query) {
        const q = query.trim().toLowerCase();
        if (!(`${r.applicantName} ${r.programId}`.toLowerCase()).includes(q)) return false;
      }
      if (from && r.admissionDate && new Date(r.admissionDate) < new Date(from)) return false;
      if (to && r.admissionDate && new Date(r.admissionDate) > new Date(to)) return false;
      return true;
    });
  }, [all, status, appId, from, to, query]);

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
          <Field label="Applicant or program">
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
          </Field>
          <Field label="Application ID">
            <TextInput value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="app-1001" />
          </Field>
          <Field label="From">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Status">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value as any)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-ink-soft)]">Showing {filtered.length} of {all.length} admissions</p>
          <SecondaryButton onClick={reset}>Reset filters</SecondaryButton>
        </div>
      </Card>

      <TableFrame>
        <thead>
          <tr>
            <Th>Applicant</Th>
            <Th>Application ID</Th>
            <Th>Study program</Th>
            <Th>Choice</Th>
            <Th>Status</Th>
            <Th className="w-28" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <Td>{r.applicantName}</Td>
              <Td className="text-[var(--color-ink-soft)]">{r.applicationId}</Td>
              <Td className="text-[var(--color-ink-soft)]">{r.programId}</Td>
              <Td className="text-[var(--color-ink-soft)]">{r.choice}</Td>
              <Td className="text-[var(--color-ink-soft)]">{r.status}</Td>
              <Td className="text-right">
                <Link href={`/institution/admissions/${r.id}`} className="text-sm text-[var(--color-ink)] underline">View</Link>
              </Td>
            </tr>
          ))}

          {filtered.length === 0 && (
            <tr>
              <Td colSpan={6} className="py-10 text-center text-sm text-[var(--color-ink-soft)]">No admissions match these filters.</Td>
            </tr>
          )}
        </tbody>
      </TableFrame>
    </div>
  );
}
