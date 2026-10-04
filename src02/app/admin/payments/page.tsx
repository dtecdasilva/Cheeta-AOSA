import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { AdminFeeApprovals } from "@/components/payments/FeePayments";

export default async function AdminFeePaymentsPage() {
  const user = await requireRole(["AOSA_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Application fee payments" description="Check each payment students have recorded and approve it. Approval issues the bank code institutions use to identify paid students." />
      <AdminFeeApprovals reviewerName={user.fullName} />
    </main>
  );
}
