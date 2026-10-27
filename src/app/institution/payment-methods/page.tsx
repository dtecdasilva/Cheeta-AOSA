import { requireRole } from "@/lib/auth/guard";
import PaymentMethodsList from "@/components/institution/PaymentMethodsList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Payment Methods")} description={tr("How applicants can pay their fees to your institution.")} />
      <PaymentMethodsList />
    </main>
  );
}
