"use client";

import Link from "next/link";
import { mockBillingConfigs } from "@/lib/mockData/billing";
import { ButtonLinkClass } from "@/components/Form";
import { formatCurrency } from "@/lib/utils";
import { SectionHeading, RowList, Row, RowAction, EmptyState, Pill } from "@/components/ui";

export default function BillingList({ institutionId }: { institutionId: string }) {
  const items = mockBillingConfigs.filter((f) => f.institutionId === institutionId);

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Billing configuration"
        actions={
          <Link href="/institution/billing/add" className={ButtonLinkClass("primary")}>
            Add fee
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No fees configured yet."
          action={
            <Link href="/institution/billing/add" className={ButtonLinkClass("secondary")}>
              Configure the first fee
            </Link>
          }
        />
      ) : (
        <RowList>
          {items.map((it) => (
            <Row
              key={it.id}
              title={it.name}
              subtitle={`${it.type} · ${it.category} · effective ${it.effectiveDate}`}
              meta={
                <div className="flex items-center gap-3">
                  <span className="font-[var(--font-display)] text-sm text-[var(--color-ink)]">
                    {formatCurrency(it.amount)}
                  </span>
                  {it.status === "active" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
                </div>
              }
              actions={
                <>
                  <RowAction href={`/institution/billing/${it.id}`}>View</RowAction>
                  <RowAction href={`/institution/billing/${it.id}/edit`}>Edit</RowAction>
                </>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  );
}
