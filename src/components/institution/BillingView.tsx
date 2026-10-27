import { FEE_CATEGORY_LABELS, FEE_TYPE_LABELS, type Fee } from "@/lib/institution/fees";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

const PERIOD_LABELS: Record<Fee["period"], string> = { UPCOMING: "Not started yet", CURRENT: "In effect", ENDED: "Ended" };

export default async function BillingView({ config, canEdit }: { config: Fee; canEdit: boolean }) {
  const tr = await getT();
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={tr(config.name)} description={`${FEE_TYPE_LABELS[config.type] ?? config.type} · ${FEE_CATEGORY_LABELS[config.category] ?? config.category}`} />
        <DescriptionList
          items={[
            { label: tr("Amount"), value: config.currency === "XAF" ? formatCurrency(config.amount) : `${config.amount.toLocaleString("en-GB")} ${config.currency}` },
            { label: tr("Currency"), value: config.currency },
            { label: tr("Effective from"), value: formatDate(config.effectiveDate) },
            { label: tr("Effective until"), value: config.effectiveTo ? formatDate(config.effectiveTo) : tr("No end date") },
            { label: tr("Period"), value: tr(PERIOD_LABELS[config.period]) },
            { label: tr("Status"), value: config.status === "ACTIVE" ? tr("Active") : tr("Inactive") },
            { label: tr("Notes"), value: config.notes },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/billing/${config.id}/edit`}>{tr("Edit")}</RowAction>}
    </div>
  );
}
