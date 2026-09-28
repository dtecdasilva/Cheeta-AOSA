"use client";

import Link from "next/link";
import { useState } from "react";
import { mockPaymentMethods, PaymentMethodConfig } from "@/lib/mockData/paymentMethods";
import { ButtonLinkClass } from "@/components/Form";
import { SectionHeading, RowList, Row, RowAction, EmptyState, Pill } from "@/components/ui";

const TYPE_LABELS: Record<PaymentMethodConfig["type"], string> = {
  bank: "Bank account",
  money_transfer: "Money transfer",
  mobile_operator: "Mobile operator",
  debit_wallet: "Debit wallet",
};

export default function PaymentMethodsList({ institutionId }: { institutionId: string }) {
  // Local state only. The previous version also mutated the imported
  // `mockPaymentMethods` array in place, so toggling or deleting here
  // silently rewrote the module-level data every other screen reads from
  // — and those edits survived until a full reload, in a way a real API
  // call never would. Swapping this for a real endpoint later means
  // replacing these handlers, not untangling shared mutable state.
  const [items, setItems] = useState<PaymentMethodConfig[]>(() =>
    mockPaymentMethods.filter((p) => p.institutionId === institutionId)
  );

  function toggle(id: string) {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, active: !it.active } : it)));
  }

  function remove(id: string) {
    setItems((s) => s.filter((it) => it.id !== id));
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Payment methods"
        actions={
          <Link href="/institution/payment-methods/add" className={ButtonLinkClass("primary")}>
            Add method
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No payment methods configured."
          action={
            <Link href="/institution/payment-methods/add" className={ButtonLinkClass("secondary")}>
              Add the first method
            </Link>
          }
        />
      ) : (
        <RowList>
          {items.map((m) => (
            <Row
              key={m.id}
              title={m.label}
              subtitle={TYPE_LABELS[m.type]}
              meta={m.active ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
              actions={
                <>
                  <RowAction href={`/institution/payment-methods/${m.id}`}>View</RowAction>
                  <RowAction href={`/institution/payment-methods/${m.id}/edit`}>Edit</RowAction>
                  <RowAction tone="muted" onClick={() => toggle(m.id)}>
                    {m.active ? "Deactivate" : "Activate"}
                  </RowAction>
                  <RowAction tone="danger" onClick={() => remove(m.id)}>
                    Delete
                  </RowAction>
                </>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  );
}
