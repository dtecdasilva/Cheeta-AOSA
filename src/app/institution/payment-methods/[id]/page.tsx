import { requireRole } from "@/lib/auth/guard";
import PaymentMethodView from "@/components/institution/PaymentMethodView";
import type { PaymentMethod } from "@/lib/institution/paymentMethods";
import { institutionPaymentMethodResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  // Confined to the caller's own institution: another institution's id is "not found".
  const record = await findOwn<PaymentMethod>(institutionPaymentMethodResource, user, id);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Payment method" />
      {record ? <PaymentMethodView method={record} canEdit={user.role === "INSTITUTION_ADMIN"} /> : <EmptyState message="This payment method doesn't exist, or belongs to another institution." />}
    </main>
  );
}
