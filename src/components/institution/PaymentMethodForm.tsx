"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { PaymentMethodConfig, mockPaymentMethods, PaymentMethodType } from "@/lib/mockData/paymentMethods";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentMethodForm({ institutionId, initial }: { institutionId: string; initial?: PaymentMethodConfig }) {
  const [form, setForm] = useState<Partial<PaymentMethodConfig>>({ ...(initial ?? {}), institutionId });
  const router = useRouter();

  function onChange<K extends keyof PaymentMethodConfig>(k: K, v: any) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    if (initial) {
      const idx = mockPaymentMethods.findIndex((p) => p.id === initial.id);
      if (idx !== -1) mockPaymentMethods[idx] = { ...(mockPaymentMethods[idx] as PaymentMethodConfig), ...(form as PaymentMethodConfig) };
    } else {
      const id = `pm-${Date.now()}`;
      mockPaymentMethods.push({ ...(form as PaymentMethodConfig), id } as PaymentMethodConfig);
    }
    router.push("/institution/payment-methods");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Field label="Label" required>
        <TextInput value={form.label ?? ""} onChange={(e) => onChange("label", e.target.value)} />
      </Field>

      <Field label="Type">
        <SelectInput value={form.type ?? "bank"} onChange={(e) => onChange("type", e.target.value as PaymentMethodType)}>
          <option value="bank">Bank account (deposit)</option>
          <option value="money_transfer">Money transfer</option>
          <option value="mobile_operator">Mobile operator transfer</option>
          <option value="debit_wallet">Debit wallet</option>
        </SelectInput>
      </Field>

      {form.type === "bank" && (
        <>
          <Field label="Bank account name">
            <TextInput value={form.bank?.accountName ?? ""} onChange={(e) => onChange("bank", { ...(form.bank ?? {}), accountName: e.target.value })} />
          </Field>
          <Field label="Account number">
            <TextInput value={form.bank?.accountNumber ?? ""} onChange={(e) => onChange("bank", { ...(form.bank ?? {}), accountNumber: e.target.value })} />
          </Field>
          <Field label="Bank name">
            <TextInput value={form.bank?.bankName ?? ""} onChange={(e) => onChange("bank", { ...(form.bank ?? {}), bankName: e.target.value })} />
          </Field>
          <Field label="SWIFT">
            <TextInput value={form.bank?.swift ?? ""} onChange={(e) => onChange("bank", { ...(form.bank ?? {}), swift: e.target.value })} />
          </Field>
        </>
      )}

      {form.type === "mobile_operator" && (
        <>
          <Field label="Operator">
            <TextInput value={form.mobile?.operator ?? ""} onChange={(e) => onChange("mobile", { ...(form.mobile ?? {}), operator: e.target.value })} />
          </Field>
          <Field label="Number">
            <TextInput value={form.mobile?.number ?? ""} onChange={(e) => onChange("mobile", { ...(form.mobile ?? {}), number: e.target.value })} />
          </Field>
        </>
      )}

      {form.type === "money_transfer" && (
        <Field label="Provider / Instructions">
          <TextInput value={form.money?.instructions ?? ""} onChange={(e) => onChange("money", { ...(form.money ?? {}), instructions: e.target.value })} />
        </Field>
      )}

      {form.type === "debit_wallet" && (
        <>
          <Field label="Provider">
            <TextInput value={form.wallet?.provider ?? ""} onChange={(e) => onChange("wallet", { ...(form.wallet ?? {}), provider: e.target.value })} />
          </Field>
          <Field label="Wallet ID">
            <TextInput value={form.wallet?.walletId ?? ""} onChange={(e) => onChange("wallet", { ...(form.wallet ?? {}), walletId: e.target.value })} />
          </Field>
        </>
      )}

      <Field label="Active">
        <SelectInput value={form.active ? "true" : "false"} onChange={(e) => onChange("active", e.target.value === "true")}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </SelectInput>
      </Field>

      <div className="flex items-center gap-2">
        <PrimaryButton onClick={onSave}>Save</PrimaryButton>
        <SecondaryButton onClick={() => router.back()}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
