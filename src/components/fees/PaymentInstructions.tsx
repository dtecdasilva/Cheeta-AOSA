"use client";

import { useState } from "react";
import { mockInstitutions } from "@/lib/mockData/institutions";
import { getPaymentConfigForInstitution } from "@/lib/mockData/payments";

export default function PaymentInstructions({ method }: { method: "bank" | "mobile" | "money" | "wallet" }) {
  const [institutionId, setInstitutionId] = useState(mockInstitutions[0].id);
  const config = getPaymentConfigForInstitution(institutionId);

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <label className="text-sm text-[var(--color-ink-soft)]">Select institution</label>
        <div className="mt-2">
          <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} className="border px-3 py-2 rounded">
            {mockInstitutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!config && <div className="p-4 border rounded">No payment configuration available for this institution.</div>}

      {config && method === "bank" && config.bank && (
        <div className="border rounded p-4">
          <div className="font-medium">Bank account details</div>
          <div className="text-sm text-[var(--color-ink-soft)] mt-2">
            <div><strong>Bank:</strong> {config.bank.bankName} {config.bank.branch ? `, ${config.bank.branch}` : ""}</div>
            <div><strong>Account name:</strong> {config.bank.accountName}</div>
            <div><strong>Account number:</strong> {config.bank.accountNumber}</div>
            {config.bank.instructions && <div className="mt-2 text-xs text-[var(--color-ink-faint)]">{config.bank.instructions}</div>}
          </div>
        </div>
      )}

      {config && method === "mobile" && config.mobileMoney && (
        <div className="border rounded p-4">
          <div className="font-medium">Mobile money options</div>
          <div className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {config.mobileMoney.map((m, idx) => (
              <div key={idx} className="mb-2">
                <div><strong>{m.operator}</strong> — {m.accountNumber}</div>
                {m.accountName && <div className="text-xs">Account: {m.accountName}</div>}
                {m.instructions && <div className="text-xs text-[var(--color-ink-faint)]">{m.instructions}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {config && method === "money" && config.moneyTransfer && (
        <div className="border rounded p-4">
          <div className="font-medium">Money transfer instructions</div>
          <div className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {config.moneyTransfer.map((m, idx) => (
              <div key={idx} className="mb-2">
                <div><strong>{m.provider}</strong> — Recipient: {m.recipientName}</div>
                <div className="text-xs">Reference: {m.referenceFormat}</div>
                {m.instructions && <div className="text-xs text-[var(--color-ink-faint)]">{m.instructions}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {config && method === "wallet" && config.debitWallet && (
        <div className="border rounded p-4">
          <div className="font-medium">Debit wallet</div>
          <div className="mt-2 text-sm text-[var(--color-ink-soft)]">
            <div><strong>{config.debitWallet.walletName}</strong> — Wallet ID: {config.debitWallet.walletId}</div>
            {config.debitWallet.instructions && <div className="text-xs text-[var(--color-ink-faint)]">{config.debitWallet.instructions}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
