import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import PaymentMethodForm from "@/components/institution/PaymentMethodForm";
import { mockPaymentMethods } from "@/lib/mockData/paymentMethods";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  const institutionId = resolveInstitutionId(user);
  // Scoped to the caller's own institution — an id belonging to another
  // institution reads as "not found" rather than being served.
  const record = mockPaymentMethods.find((r) => r.id === id && r.institutionId === institutionId);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Edit payment method" />
      {record ? (
        <PaymentMethodForm institutionId={institutionId} initial={record} />
      ) : (
        <EmptyState message="This payment method doesn't exist, or belongs to another institution." />
      )}
    </main>
  );
}
