import { requireRole } from "@/lib/auth/guard";
import BillingList from "@/components/institution/BillingList";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Billing" description="Fees applicants are charged when applying to your institution." />
      <BillingList />
    </main>
  );
}
