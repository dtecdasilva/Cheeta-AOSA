import { requireRole } from "@/lib/auth/guard";
import PaymentMethodsList from "@/components/institution/PaymentMethodsList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Payment Methods" description="How applicants can pay their fees to your institution." />
      <PaymentMethodsList />
    </main>
  );
}
