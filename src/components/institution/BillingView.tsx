"use client";

import { FeeConfig } from "@/lib/mockData/billing";

export default function BillingView({ config }: { config: FeeConfig }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">{config.name}</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">{config.type} • {config.category}</p>
      </div>

      <div className="rounded border border-[var(--color-line)] bg-white p-4 space-y-2">
        <p><strong>Currency:</strong> {config.currency}</p>
        <p><strong>Amount:</strong> {config.amount}</p>
        <p><strong>Effective date:</strong> {config.effectiveDate}</p>
        <p><strong>Status:</strong> {config.status}</p>
      </div>
    </div>
  );
}
