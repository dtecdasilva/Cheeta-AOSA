import { requireRole } from "@/lib/auth/guard";
import PaymentMethodForm from "@/components/institution/PaymentMethodForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  // Only an institution administrator can change the institution's records; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add payment method" description="Configure a new way for applicants to pay." />
      <PaymentMethodForm />
    </main>
  );
}
