import { requireRole } from "@/lib/auth/guard";
import PaymentMethodView from "@/components/institution/PaymentMethodView";
import type { PaymentMethod } from "@/lib/institution/paymentMethods";
import { institutionPaymentMethodResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  // Confined to the caller's own institution: another institution's id is "not found".
  const record = await findOwn<PaymentMethod>(institutionPaymentMethodResource, user, id);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Payout account")} />
      {record ? <PaymentMethodView method={record} canEdit={user.role === "INSTITUTION_ADMIN"} /> : <EmptyState message={tr("This payout account doesn't exist, or belongs to another institution.")} />}
    </main>
  );
}
