"use client";

import { PaymentMethodConfig } from "@/lib/mockData/paymentMethods";

export default function PaymentMethodView({ method }: { method: PaymentMethodConfig }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">{method.label}</h2>
        <p className="text-xs text-[var(--color-ink-soft)]">Type: {method.type}</p>
      </div>

      <div className="rounded border border-[var(--color-line)] bg-white p-4 space-y-2">
        {method.type === "bank" && method.bank && (
          <div>
            <p><strong>Account name:</strong> {method.bank.accountName}</p>
            <p><strong>Account number:</strong> {method.bank.accountNumber}</p>
            <p><strong>Bank:</strong> {method.bank.bankName}</p>
            {method.bank.swift && <p><strong>SWIFT:</strong> {method.bank.swift}</p>}
            {method.bank.notes && <p><strong>Notes:</strong> {method.bank.notes}</p>}
          </div>
        )}

        {method.type === "mobile_operator" && method.mobile && (
          <div>
            <p><strong>Operator:</strong> {method.mobile.operator}</p>
            <p><strong>Number:</strong> {method.mobile.number}</p>
            {method.mobile.accountName && <p><strong>Account name:</strong> {method.mobile.accountName}</p>}
            {method.mobile.notes && <p><strong>Notes:</strong> {method.mobile.notes}</p>}
          </div>
        )}

        {method.type === "money_transfer" && method.money && (
          <div>
            <p><strong>Provider:</strong> {method.money.provider}</p>
            <p><strong>Instructions:</strong> {method.money.instructions}</p>
          </div>
        )}

        {method.type === "debit_wallet" && method.wallet && (
          <div>
            <p><strong>Provider:</strong> {method.wallet.provider}</p>
            <p><strong>Wallet ID:</strong> {method.wallet.walletId}</p>
            {method.wallet.instructions && <p><strong>Instructions:</strong> {method.wallet.instructions}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
