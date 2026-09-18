"use client";

import Link from "next/link";
import { mockBillingConfigs, FeeConfig } from "@/lib/mockData/billing";
import { PrimaryButton } from "@/components/Form";

export default function BillingList({ institutionId }: { institutionId: string }) {
  const items = mockBillingConfigs.filter((f) => f.institutionId === institutionId);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">Billing configuration</h2>
        <Link href="/institution/billing/add">
          <PrimaryButton>Add fee</PrimaryButton>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between rounded border border-[var(--color-line)] bg-white p-3">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{it.name}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">{it.type} • {it.category} • {it.currency} {it.amount}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/institution/billing/${it.id}`} className="text-sm text-[var(--color-ink)] underline">View</Link>
              <Link href={`/institution/billing/${it.id}/edit`} className="text-sm text-[var(--color-ink)] underline">Edit</Link>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No billing configurations yet.</p>}
      </div>
    </div>
  );
}
