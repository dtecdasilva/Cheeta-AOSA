import Link from "next/link";
import { getInstitutionPortalCounts } from "@/lib/mockData/institutionPortal";
import { resolveInstitutionId } from "@/lib/auth/institution";
import type { PublicUser } from "@/lib/auth/users";
import { AwaitingPaymentList } from "@/components/payments/FeePayments";

export default function InstitutionDashboard({ user }: { user: PublicUser }) {
  const counts = getInstitutionPortalCounts(resolveInstitutionId(user));

  // Each tile links somewhere real. A number the reader can't act on is
  // just decoration, and the applications table's own filters are where
  // each of these subsets actually lives.
  const items: { label: string; value: number; href: string }[] = [
    { label: "Total applications", value: counts.applications, href: "/institution/applications" },
    { label: "Pending applications", value: counts.pending, href: "/institution/applications" },
    { label: "No payment recorded", value: counts.paymentVerification, href: "/institution/applications" },
    { label: "Upload verification", value: counts.uploadVerification, href: "/institution/applications" },
    { label: "Acknowledged", value: counts.acknowledged, href: "/institution/applications" },
    { label: "Rejected", value: counts.rejected, href: "/institution/applications" },
    { label: "Ready for deliberation", value: counts.deliberation, href: "/institution/applications" },
    { label: "Accepted applicants", value: counts.accepted, href: "/institution/applications" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="bg-[var(--color-surface)] px-5 py-4 transition-colors hover:bg-[var(--color-paper)]"
          >
            <p className="font-bold tracking-tight text-2xl text-[var(--color-ink)] sm:text-3xl">{it.value}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{it.label}</p>
          </Link>
        ))}
      </div>

      {/* Payments are approved by AOSA; the institution only learns who is
          waiting, by first name, until then. See lib/payments/privacy.ts. */}
      <AwaitingPaymentList institutionId={resolveInstitutionId(user)} />

      <div className="rounded-xl border border-dashed border-[var(--color-line-strong)] px-5 py-4 text-sm text-[var(--color-ink-soft)]">
        These figures are derived from the demo application set for{" "}
        <span className="font-medium text-[var(--color-ink)]">{user.institutionName ?? "your institution"}</span>. They
        will reflect live intake once the application database is connected.
      </div>
    </div>
  );
}
