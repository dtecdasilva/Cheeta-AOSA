"use client";

import { useState } from "react";
import { PaymentInfo } from "@/lib/types";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { institutions } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

const METHODS = ["Mobile Money", "Bank Transfer", "Card Payment", "Cash at Institution"];

export function FeesStep({
  institutionIds,
  payment,
  editable,
  onSave,
  onSubmit,
}: {
  institutionIds: string[];
  payment: PaymentInfo | null;
  editable: boolean;
  onSave: (payment: PaymentInfo) => void;
  onSubmit: () => void;
}) {
  const lineItems = institutionIds
    .map((id) => institutions.find((i) => i.id === id))
    .filter((i): i is (typeof institutions)[number] => !!i);

  const total = lineItems.reduce((sum, i) => sum + i.applicationFee + i.webFee, 0);

  const [method, setMethod] = useState(payment?.method ?? METHODS[0]);
  const [reference, setReference] = useState(payment?.reference ?? "");
  const [saved, setSaved] = useState(false);

  const isComplete = reference.trim().length > 0;

  function buildPayment(): PaymentInfo {
    return { method, reference, amount: total, paidAt: new Date().toISOString() };
  }

  return (
    <div className="space-y-6">
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-ink-faint)]">
              <th className="px-5 py-2.5 font-normal">Institution</th>
              <th className="px-5 py-2.5 font-normal">Application fee</th>
              <th className="px-5 py-2.5 font-normal">Web/admin fee</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((i) => (
              <tr key={i.id} className="border-b border-[var(--color-line)]">
                <td className="px-5 py-3 text-[var(--color-ink)]">{i.name}</td>
                <td className="px-5 py-3 text-[var(--color-ink-soft)]">{formatCurrency(i.applicationFee)}</td>
                <td className="px-5 py-3 text-[var(--color-ink-soft)]">{formatCurrency(i.webFee)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-5 py-3 font-medium text-[var(--color-ink)]">Total due</td>
              <td colSpan={2} className="px-5 py-3 font-[var(--font-display)] text-lg text-[var(--color-ink)]">
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-5 border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:grid-cols-2">
        <Field label="Payment method" required>
          <SelectInput value={method} onChange={(e) => { setMethod(e.target.value); setSaved(false); }} disabled={!editable}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Transaction reference" required hint="From your mobile money, bank or card receipt.">
          <TextInput value={reference} onChange={(e) => { setReference(e.target.value); setSaved(false); }} disabled={!editable} />
        </Field>
      </div>

      {editable && (
        <div className="flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
          <SecondaryButton
            type="button"
            onClick={() => {
              onSave(buildPayment());
              setSaved(true);
            }}
          >
            Save progress
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={!isComplete}
            onClick={() => {
              onSave(buildPayment());
              onSubmit();
            }}
          >
            Submit and continue
          </PrimaryButton>
          {saved && <span className="text-xs text-[var(--color-success)]">Saved</span>}
        </div>
      )}
    </div>
  );
}
