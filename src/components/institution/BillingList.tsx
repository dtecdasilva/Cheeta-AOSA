"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import { FEE_CATEGORY_LABELS, FEE_TYPE_LABELS, type Fee } from "@/lib/institution/fees";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";

/** An amount in its own currency: francs the usual way, anything else with its code. */
export function feeAmount(amount: number, currency: string) {
  return currency === "XAF" ? formatCurrency(amount) : `${amount.toLocaleString("en-GB")} ${currency}`;
}

export function feePeriod(fee: Pick<Fee, "effectiveDate" | "effectiveTo">) {
  return fee.effectiveTo ? `${formatDate(fee.effectiveDate)} to ${formatDate(fee.effectiveTo)}` : `from ${formatDate(fee.effectiveDate)}`;
}

/**
 * The institution's fee schedule, from /api/institution/fees. The web fee
 * is shown for information: it is the platform's charge, set by Cheeta.
 */
export default function BillingList() {
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, extra, error, setStatus } = useInstitutionList<Fee, { webFee?: { amount: number; currency: string } }>("fees");

  return (
    <InstitutionListShell
      title="Billing configuration"
      addHref="/institution/billing/add"
      addLabel="Add fee"
      emptyMessage="No fees configured yet."
      canEdit={canEdit}
      loading={!items && !error}
      error={error}
      isEmpty={items?.length === 0}
      note={
        extra?.webFee ? (
          <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            Web fee: <span className="font-semibold text-[var(--color-ink)]">{feeAmount(extra.webFee.amount, extra.webFee.currency)}</span> per application. This is the platform&apos;s fee, paid by applicants on top of your
            application fee. It is set by Cheeta and isn&apos;t part of your schedule.
          </p>
        ) : undefined
      }
    >
      {(items ?? []).map((it) => (
        <Row
          key={it.id}
          title={it.name}
          subtitle={`${FEE_TYPE_LABELS[it.type] ?? it.type} · ${FEE_CATEGORY_LABELS[it.category] ?? it.category} · ${feePeriod(it)}`}
          meta={
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[var(--color-ink)]">{feeAmount(it.amount, it.currency)}</span>
              {it.status !== "ACTIVE" ? <Pill tone="muted">Inactive</Pill> : it.period === "CURRENT" ? <Pill tone="success">In effect</Pill> : <Pill tone="muted">{it.period === "UPCOMING" ? "Upcoming" : "Ended"}</Pill>}
            </div>
          }
          actions={
            <>
              <RowAction href={`/institution/billing/${it.id}`}>View</RowAction>
              {canEdit && <RowAction href={`/institution/billing/${it.id}/edit`}>Edit</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(it.id, it.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {it.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
