import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionApplicationFees } from "@/components/payments/InstitutionApplicationFees";
import { getT } from "@/lib/i18n/server";

export default async function InstitutionFeePaymentsPage() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Application fees")} description={tr("Applicants whose fee AOSA has approved, identified by bank code. Anyone Cheeta has not approved yet shows by first name only, as not paid.")} />
      <InstitutionApplicationFees />
    </main>
  );
}
