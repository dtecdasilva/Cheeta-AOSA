import { PAYMENT_METHOD_TYPE_LABELS, VERIFICATION_LABELS, describePaymentMethod, type PaymentMethod } from "@/lib/institution/paymentMethods";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

/** One payment method. The detail rows differ by kind (and are labelled for it); the layout does not. */
export default async function PaymentMethodView({ method, canEdit }: { method: PaymentMethod; canEdit: boolean }) {
  const tr = await getT();
  const verification =
    method.verification === "VERIFIED" && method.verifiedAt
      ? tr("Verified by Cheeta administration on {value}", { value: formatDate(method.verifiedAt) })
      : method.verification === "REJECTED"
      ? `Rejected by Cheeta administration${method.verificationNote ? `: ${method.verificationNote}` : ""}`
      : tr("{value}: not shown to applicants yet", { value: VERIFICATION_LABELS[method.verification] });

  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={tr(method.label)} description={tr(PAYMENT_METHOD_TYPE_LABELS[method.type])} />
        <DescriptionList
          items={[
            ...describePaymentMethod(method).map((row) => ({ label: row.label, value: row.value })),
            { label: tr("Instructions for payers"), value: method.instructions },
            { label: tr("Tuition"), value: method.acceptsTuition ? tr("Also accepts tuition payments") : tr("Application fees only") },
            { label: tr("Verification"), value: verification },
            { label: tr("Status"), value: method.status === "ACTIVE" ? tr("Active") : tr("Inactive") },
            { label: tr("Shown to applicants"), value: method.status === "ACTIVE" && method.verification === "VERIFIED" ? tr("Yes") : tr("No") },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/payment-methods/${method.id}/edit`}>{tr("Edit")}</RowAction>}
    </div>
  );
}
