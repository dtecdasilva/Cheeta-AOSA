"use client";

import { mockInstitutionPortalCounts } from "@/lib/mockData/institutionPortal";
import { PublicUser } from "@/lib/auth/users";

export default function InstitutionDashboard({ user }: { user: PublicUser }) {
  const counts = mockInstitutionPortalCounts[user.institutionId ?? "inst-1"] ?? { applications: 0, pending: 0, paymentVerification: 0, uploadVerification: 0, acknowledged: 0, rejected: 0, deliberation: 0, accepted: 0 };

  const items = [
    { label: "Total applications", value: counts.applications },
    { label: "Pending applications", value: counts.pending },
    { label: "Payment verification", value: counts.paymentVerification },
    { label: "Upload verification", value: counts.uploadVerification },
    { label: "Acknowledged applications", value: counts.acknowledged },
    { label: "Rejected applications", value: counts.rejected },
    { label: "Ready for deliberation", value: counts.deliberation },
    { label: "Accepted applicants", value: counts.accepted },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded border border-[var(--color-line)] bg-white p-4">
            <p className="text-sm text-[var(--color-ink-soft)]">{it.label}</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{it.value}</p>
          </div>
        ))}
      </div>

      <div className="border border-[var(--color-line)] bg-white p-5">
        <p className="mb-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">Notes</p>
        <p className="text-sm text-[var(--color-ink-soft)]">This dashboard shows mock data for institution <strong>{user.institutionName}</strong>.</p>
      </div>
    </div>
  );
}
