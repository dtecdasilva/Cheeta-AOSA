import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { PaymentVerificationDesk } from "@/components/payments/PaymentVerificationDesk";

export default async function AdminFeePaymentsPage() {
  await requireRole(["AOSA_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Application fee payments" description="Check each payment applicants have recorded, then approve or reject it. Approval issues the bank code institutions use to identify paid applicants." />
      <PaymentVerificationDesk />
    </main>
  );
}
