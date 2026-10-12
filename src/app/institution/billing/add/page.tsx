import { requireRole } from "@/lib/auth/guard";
import BillingForm from "@/components/institution/BillingForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page() {
  // Only an institution administrator can change the institution's records; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Add fee" description="Add a fee to your schedule: what it is for, who pays it, and from when." />
      <BillingForm />
    </main>
  );
}
