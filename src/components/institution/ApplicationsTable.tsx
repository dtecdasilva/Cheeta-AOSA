"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { findApplicationsForInstitution } from "@/lib/mockData/applications";
import { StatusBadge } from "@/components/StatusBadge";
import { TextInput, SelectInput, PrimaryButton } from "@/components/Form";

export default function ApplicationsTable({ institutionId }: { institutionId: string }) {
  const all = useMemo(() => findApplicationsForInstitution(institutionId), [institutionId]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [applicant, setApplicant] = useState("");
  const [appId, setAppId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return all.filter((a) => {
      if (status !== "ALL") {
        if (a.perInstitutionStatus[institutionId] !== status) return false;
      }
      if (applicant) {
        const full = `${a.personalInfo?.firstName ?? ""} ${a.personalInfo?.lastName ?? ""}`.toLowerCase();
        if (!full.includes(applicant.toLowerCase())) return false;
      }
      if (appId) {
        if (!a.id.includes(appId)) return false;
      }
      if (from) {
        if (new Date(a.createdAt) < new Date(from)) return false;
      }
      if (to) {
        if (new Date(a.createdAt) > new Date(to)) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        if (!(a.personalInfo?.email?.toLowerCase().includes(q) || a.personalInfo?.firstName?.toLowerCase().includes(q) || a.personalInfo?.lastName?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [all, status, applicant, appId, from, to, query, institutionId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput placeholder="Search email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
        <TextInput placeholder="Applicant name" value={applicant} onChange={(e) => setApplicant(e.target.value)} />
        <TextInput placeholder="Application ID" value={appId} onChange={(e) => setAppId(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="text-xs text-[var(--color-ink-soft)]">From</label>
          <input type="date" className="w-full border px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-[var(--color-ink-soft)]">To</label>
          <input type="date" className="w-full border px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-[var(--color-ink-soft)]">Status</label>
          <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">All</option>
            <option value="INCOMPLETE">INCOMPLETE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="A_ACKNOWLEDGED">A_ACKNOWLEDGED</option>
            <option value="I_ACKNOWLEDGED">I_ACKNOWLEDGED</option>
            <option value="A_REJECTED">A_REJECTED</option>
            <option value="I_REJECTED">I_REJECTED</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="RESUBMITTED">RESUBMITTED</option>
          </SelectInput>
        </div>
        <div className="flex items-end">
          <PrimaryButton onClick={() => { setQuery(""); setApplicant(""); setAppId(""); setFrom(""); setTo(""); setStatus("ALL"); }}>Reset</PrimaryButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-left text-xs text-[var(--color-ink-soft)]">
              <th className="w-32">Application ID</th>
              <th>Applicant</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Programs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-3 text-sm">{a.id}</td>
                <td className="py-3 text-sm">{a.personalInfo ? `${a.personalInfo.firstName} ${a.personalInfo.lastName}` : "-"}<div className="text-xs text-[var(--color-ink-soft)]">{a.personalInfo?.email}</div></td>
                <td className="py-3 text-sm">{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '-'}</td>
                <td className="py-3"><StatusBadge status={a.perInstitutionStatus[institutionId]} /></td>
                <td className="py-3 text-sm">{a.programChoices.map((p) => p.programId).join(", ")}</td>
                <td className="py-3 text-right"><Link href={`/institution/applications/${a.id}`} className="text-sm underline">View</Link></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-[var(--color-ink-soft)]">No applications found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
