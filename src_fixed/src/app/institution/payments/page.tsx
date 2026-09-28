import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionFeePayments } from "@/components/payments/FeePayments";

export default async function InstitutionFeePaymentsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Application fees" description="Applicants whose fee AOSA has approved, identified by bank code. Anyone still being checked shows as awaiting payment." />
      <InstitutionFeePayments institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
