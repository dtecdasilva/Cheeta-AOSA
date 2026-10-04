import { FeeConfig } from "@/lib/mockData/billing";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function BillingView({ config }: { config: FeeConfig }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={config.name} description={`${config.type} · ${config.category}`} />
        <DescriptionList
          items={[
            // Amounts are stored in XAF platform-wide, so they are formatted
            // the same way here as everywhere else rather than printed raw.
            { label: "Amount", value: formatCurrency(config.amount) },
            { label: "Currency", value: config.currency },
            { label: "Effective date", value: config.effectiveDate },
            { label: "Status", value: config.status === "active" ? "Active" : "Inactive" },
            { label: "Notes", value: config.notes },
          ]}
        />
      </Card>
      <RowAction href={`/institution/billing/${config.id}/edit`}>Edit</RowAction>
    </div>
  );
}
