import { PAYMENT_METHOD_TYPE_LABELS, VERIFICATION_LABELS, describePaymentMethod, type PaymentMethod } from "@/lib/institution/paymentMethods";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

/** One payment method. The detail rows differ by kind (and are labelled for it); the layout does not. */
export default function PaymentMethodView({ method, canEdit }: { method: PaymentMethod; canEdit: boolean }) {
  const verification =
    method.verification === "VERIFIED" && method.verifiedAt
      ? `Verified by Cheeta administration on ${formatDate(method.verifiedAt)}`
      : method.verification === "REJECTED"
      ? `Rejected by Cheeta administration${method.verificationNote ? `: ${method.verificationNote}` : ""}`
      : `${VERIFICATION_LABELS[method.verification]}: not shown to applicants yet`;

  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={method.label} description={PAYMENT_METHOD_TYPE_LABELS[method.type]} />
        <DescriptionList
          items={[
            ...describePaymentMethod(method).map((row) => ({ label: row.label, value: row.value })),
            { label: "Instructions for payers", value: method.instructions },
            { label: "Tuition", value: method.acceptsTuition ? "Also accepts tuition payments" : "Application fees only" },
            { label: "Verification", value: verification },
            { label: "Status", value: method.status === "ACTIVE" ? "Active" : "Inactive" },
            { label: "Shown to applicants", value: method.status === "ACTIVE" && method.verification === "VERIFIED" ? "Yes" : "No" },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/payment-methods/${method.id}/edit`}>Edit</RowAction>}
    </div>
  );
}
