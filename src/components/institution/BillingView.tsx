import { FEE_CATEGORY_LABELS, FEE_TYPE_LABELS, type Fee } from "@/lib/institution/fees";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

const PERIOD_LABELS: Record<Fee["period"], string> = { UPCOMING: "Not started yet", CURRENT: "In effect", ENDED: "Ended" };

export default function BillingView({ config, canEdit }: { config: Fee; canEdit: boolean }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={config.name} description={`${FEE_TYPE_LABELS[config.type] ?? config.type} · ${FEE_CATEGORY_LABELS[config.category] ?? config.category}`} />
        <DescriptionList
          items={[
            { label: "Amount", value: config.currency === "XAF" ? formatCurrency(config.amount) : `${config.amount.toLocaleString("en-GB")} ${config.currency}` },
            { label: "Currency", value: config.currency },
            { label: "Effective from", value: formatDate(config.effectiveDate) },
            { label: "Effective until", value: config.effectiveTo ? formatDate(config.effectiveTo) : "No end date" },
            { label: "Period", value: PERIOD_LABELS[config.period] },
            { label: "Status", value: config.status === "ACTIVE" ? "Active" : "Inactive" },
            { label: "Notes", value: config.notes },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/billing/${config.id}/edit`}>Edit</RowAction>}
    </div>
  );
}
