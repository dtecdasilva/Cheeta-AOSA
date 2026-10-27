import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { PaymentVerificationDesk } from "@/components/payments/PaymentVerificationDesk";
import { getT } from "@/lib/i18n/server";

export default async function AdminFeePaymentsPage() {
  const tr = await getT();
  await requireRole(["AOSA_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Application fee payments")} description={tr("Check each payment applicants have recorded, then approve or reject it. Approval issues the bank code institutions use to identify paid applicants.")} />
      <PaymentVerificationDesk />
    </main>
  );
}
