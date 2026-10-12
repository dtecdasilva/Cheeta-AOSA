import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionApplicationFees } from "@/components/payments/InstitutionApplicationFees";

export default async function InstitutionFeePaymentsPage() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Application fees" description="Applicants whose fee AOSA has approved, identified by bank code. Anyone still being checked shows as awaiting payment." />
      <InstitutionApplicationFees />
    </main>
  );
}
