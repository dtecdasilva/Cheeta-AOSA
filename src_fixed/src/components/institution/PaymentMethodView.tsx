import { PaymentMethodConfig } from "@/lib/mockData/paymentMethods";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

const TYPE_LABELS: Record<PaymentMethodConfig["type"], string> = {
  bank: "Bank account",
  money_transfer: "Money transfer",
  mobile_operator: "Mobile operator",
  debit_wallet: "Debit wallet",
};

/** The detail rows differ per method type, but the layout does not. */
function detailsFor(method: PaymentMethodConfig): { label: string; value: React.ReactNode }[] {
  switch (method.type) {
    case "bank":
      return method.bank
        ? [
            { label: "Account name", value: method.bank.accountName },
            { label: "Account number", value: method.bank.accountNumber },
            { label: "Bank", value: method.bank.bankName },
            { label: "SWIFT", value: method.bank.swift },
            { label: "Notes", value: method.bank.notes },
          ]
        : [];
    case "mobile_operator":
      return method.mobile
        ? [
            { label: "Operator", value: method.mobile.operator },
            { label: "Number", value: method.mobile.number },
            { label: "Account name", value: method.mobile.accountName },
            { label: "Notes", value: method.mobile.notes },
          ]
        : [];
    case "money_transfer":
      return method.money
        ? [
            { label: "Provider", value: method.money.provider },
            { label: "Instructions", value: method.money.instructions },
          ]
        : [];
    case "debit_wallet":
      return method.wallet
        ? [
            { label: "Provider", value: method.wallet.provider },
            { label: "Wallet ID", value: method.wallet.walletId },
            { label: "Instructions", value: method.wallet.instructions },
          ]
        : [];
  }
}

export default function PaymentMethodView({ method }: { method: PaymentMethodConfig }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={method.label} description={TYPE_LABELS[method.type]} />
        <DescriptionList
          items={[
            ...detailsFor(method),
            { label: "Status", value: method.active ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      <RowAction href={`/institution/payment-methods/${method.id}/edit`}>Edit</RowAction>
    </div>
  );
}
