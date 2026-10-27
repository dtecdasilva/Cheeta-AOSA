import { requireRole } from "@/lib/auth/guard";
import PaymentMethodForm from "@/components/institution/PaymentMethodForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  // Only an institution administrator can change the institution's records; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Add payment method")} description={tr("Configure a new way for applicants to pay.")} />
      <PaymentMethodForm />
    </main>
  );
}
