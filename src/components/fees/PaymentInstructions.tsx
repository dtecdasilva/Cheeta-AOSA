"use client";

import { useState } from "react";
import { mockInstitutions } from "@/lib/mockData/institutions";
import { Field, SelectInput } from "@/components/Form";
import { Card, EmptyState } from "@/components/ui";
import { getPaymentConfigForInstitution } from "@/lib/mockData/payments";

export default function PaymentInstructions({ method }: { method: "bank" | "mobile" | "money" | "wallet" }) {
  const [institutionId, setInstitutionId] = useState(mockInstitutions[0].id);
  const config = getPaymentConfigForInstitution(institutionId);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 max-w-sm">
        <Field label="Select institution">
          <SelectInput value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
            {mockInstitutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {!config && <EmptyState message="No payment configuration available for this institution yet." />}

      {config && method === "bank" && config.bank && (
        <Card>
          <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Bank account details</p>
          <div className="text-sm text-[var(--color-ink-soft)] mt-2">
            <div><strong>Bank:</strong> {config.bank.bankName} {config.bank.branch ? `, ${config.bank.branch}` : ""}</div>
            <div><strong>Account name:</strong> {config.bank.accountName}</div>
            <div><strong>Account number:</strong> {config.bank.accountNumber}</div>
            {config.bank.instructions && <div className="mt-2 text-xs text-[var(--color-ink-faint)]">{config.bank.instructions}</div>}
          </div>
        </Card>
      )}

      {config && method === "mobile" && config.mobileMoney && (
        <Card>
          <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Mobile money options</p>
          <div className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {config.mobileMoney.map((m, idx) => (
              <div key={idx} className="mb-2">
                <div><strong>{m.operator}</strong> — {m.accountNumber}</div>
                {m.accountName && <div className="text-xs">Account: {m.accountName}</div>}
                {m.instructions && <div className="text-xs text-[var(--color-ink-faint)]">{m.instructions}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {config && method === "money" && config.moneyTransfer && (
        <Card>
          <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Money transfer instructions</p>
          <div className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {config.moneyTransfer.map((m, idx) => (
              <div key={idx} className="mb-2">
                <div><strong>{m.provider}</strong> — Recipient: {m.recipientName}</div>
                <div className="text-xs">Reference: {m.referenceFormat}</div>
                {m.instructions && <div className="text-xs text-[var(--color-ink-faint)]">{m.instructions}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {config && method === "wallet" && config.debitWallet && (
        <Card>
          <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Debit wallet</p>
          <div className="mt-2 text-sm text-[var(--color-ink-soft)]">
            <div><strong>{config.debitWallet.walletName}</strong> — Wallet ID: {config.debitWallet.walletId}</div>
            {config.debitWallet.instructions && <div className="text-xs text-[var(--color-ink-faint)]">{config.debitWallet.instructions}</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
