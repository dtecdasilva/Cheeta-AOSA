"use client";

import Link from "next/link";
import { mockPaymentMethods, PaymentMethodConfig } from "@/lib/mockData/paymentMethods";
import { PrimaryButton } from "@/components/Form";
import { useState } from "react";

export default function PaymentMethodsList({ institutionId }: { institutionId: string }) {
  const initial = mockPaymentMethods.filter((p) => p.institutionId === institutionId);
  const [items, setItems] = useState<PaymentMethodConfig[]>(initial);

  function toggle(id: string) {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, active: !it.active } : it)));
    const target = mockPaymentMethods.find((p) => p.id === id);
    if (target) target.active = !target.active;
  }

  function remove(id: string) {
    const idx = mockPaymentMethods.findIndex((p) => p.id === id);
    if (idx !== -1) mockPaymentMethods.splice(idx, 1);
    setItems((s) => s.filter((it) => it.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">Payment methods</h2>
        <Link href="/institution/payment-methods/add">
          <PrimaryButton>Add method</PrimaryButton>
        </Link>
      </div>

      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded border border-[var(--color-line)] bg-white p-3">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{m.label}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">{m.type} • {m.active ? 'Active' : 'Inactive'}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/institution/payment-methods/${m.id}`} className="text-sm text-[var(--color-ink)] underline">View</Link>
              <Link href={`/institution/payment-methods/${m.id}/edit`} className="text-sm text-[var(--color-ink)] underline">Edit</Link>
              <button onClick={() => toggle(m.id)} className="text-sm text-[var(--color-ink-soft)]">{m.active ? 'Deactivate' : 'Activate'}</button>
              <button onClick={() => remove(m.id)} className="text-sm text-[var(--color-danger)]">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No payment methods configured.</p>}
      </div>
    </div>
  );
}
