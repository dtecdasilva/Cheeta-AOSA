import Link from "next/link";
import type { PublicUser } from "@/lib/auth/users";
import { AwaitingPaymentList } from "@/components/payments/FeePayments";
import { dashboardCounts } from "@/server/modules/applications/institution.service";
import { getT } from "@/lib/i18n/server";

/**
 * The institution's figures, from its own applications (server: dashboardCounts).
 * A figure the staff member's permissions don't cover isn't shown.
 */
export default async function InstitutionDashboard({ user }: { user: PublicUser }) {
  const tr = await getT();
  const c = await dashboardCounts(user);

  // Each tile opens the list it counts.
  const items: { label: string; value: number | null; href: string }[] = [
    { label: tr("Applications received"), value: c.total, href: "/institution/applications" },
    { label: tr("Awaiting review"), value: c.awaitingReview, href: "/institution/applications?status=SUBMITTED" },
    { label: tr("Fee not yet approved by AOSA"), value: c.awaitingPayment, href: "/institution/payments" },
    { label: tr("Payments to confirm"), value: c.paymentToCheck, href: "/institution/payments" },
    { label: tr("Documents to verify"), value: c.uploadsToVerify, href: "/institution/applications?status=SUBMITTED" },
    { label: tr("Acknowledged (deliberation list)"), value: c.acknowledged, href: "/institution/applications/acknowledged" },
    { label: tr("Rejected"), value: c.rejected, href: "/institution/applications/rejected" },
    { label: tr("Offers awaiting reply"), value: c.offered, href: "/institution/admissions?status=OFFERED" },
    { label: tr("Offers taken up"), value: c.takenUp, href: "/institution/admissions?status=ACCEPTED" },
    { label: tr("Offers declined"), value: c.declined, href: "/institution/admissions?status=REJECTED" },
  ];
  const shown = items.filter((i) => i.value !== null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-5">
        {shown.map((it) => (
          <Link key={it.label} href={it.href} className="bg-[var(--color-surface)] px-5 py-4 transition-colors hover:bg-[var(--color-paper)]">
            <p className="font-bold tracking-tight text-2xl text-[var(--color-ink)] sm:text-3xl">{it.value}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{it.label}</p>
          </Link>
        ))}
      </div>

      {/* Payments are approved by AOSA; the institution only learns who is
          waiting, by first name, until then. See lib/payments/privacy.ts. */}
      <AwaitingPaymentList institutionId={user.institutionId ?? ""} />
    </div>
  );
}
