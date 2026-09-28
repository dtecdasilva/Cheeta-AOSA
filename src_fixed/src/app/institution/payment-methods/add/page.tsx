import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import PaymentMethodForm from "@/components/institution/PaymentMethodForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add payment method" description="Configure a new way for applicants to pay." />
      <PaymentMethodForm institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
