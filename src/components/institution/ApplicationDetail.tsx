"use client";

import { Application } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function ApplicationDetail({ application, institutionId }: { application: Application; institutionId: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Application {application.id}</h1>
            <p className="text-sm text-[var(--color-ink-soft)]">Submitted: {application.submittedAt ? new Date(application.submittedAt).toLocaleString() : 'Not submitted'}</p>
          </div>
          <div>
            <StatusBadge status={application.perInstitutionStatus[institutionId]} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <h2 className="font-medium">Applicant</h2>
          <p className="text-sm">{application.personalInfo ? `${application.personalInfo.firstName} ${application.personalInfo.lastName}` : '-'}</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{application.personalInfo?.email}</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{application.personalInfo?.phone}</p>
        </div>

        <div className="rounded border bg-white p-4">
          <h2 className="font-medium">Programs applied</h2>
          <ul className="text-sm list-disc pl-5">
            {application.programChoices.map((p) => (
              <li key={`${p.institutionId}:${p.programId}`}>{p.programId} (rank {p.rank})</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="font-medium">Documents</h2>
        <ul className="text-sm list-disc pl-5">
          {application.documents.map((d) => (
            <li key={d.id}>{d.requirementName} — {d.fileName ?? 'Not uploaded'}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
