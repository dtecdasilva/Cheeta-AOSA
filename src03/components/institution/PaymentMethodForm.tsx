"use client";

import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import {
  PaymentMethodConfig,
  PaymentMethodType,
  BankDetails,
  MobileOperatorDetails,
  MoneyTransferDetails,
  DebitWalletDetails,
} from "@/lib/mockData/paymentMethods";
import { useState } from "react";
import { useRouter } from "next/navigation";

const REQUIRED: (keyof PaymentMethodConfig)[] = ["label"];

export default function PaymentMethodForm({ institutionId, initial }: { institutionId: string; initial?: PaymentMethodConfig }) {
  const [form, setForm] = useState<Partial<PaymentMethodConfig>>({ ...(initial ?? {}), institutionId });
  const [errors, setErrors] = useState<Partial<Record<keyof PaymentMethodConfig, string>>>({});
  const router = useRouter();

  function onChange<K extends keyof PaymentMethodConfig>(k: K, v: PaymentMethodConfig[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  /**
   * The per-type detail objects have required fields, so a partial edit
   * has to be merged onto a complete default rather than spread onto
   * `undefined` — previously this type-checked only because the setter
   * took `any`, and a half-filled object could reach the config.
   */
  const EMPTY_BANK: BankDetails = { accountName: "", accountNumber: "", bankName: "" };
  const EMPTY_MOBILE: MobileOperatorDetails = { operator: "", number: "" };
  const EMPTY_MONEY: MoneyTransferDetails = { provider: "", instructions: "" };
  const EMPTY_WALLET: DebitWalletDetails = { provider: "", walletId: "" };

  const patchBank = (patch: Partial<BankDetails>) =>
    setForm((s) => ({ ...s, bank: { ...EMPTY_BANK, ...(s.bank ?? {}), ...patch } }));
  const patchMobile = (patch: Partial<MobileOperatorDetails>) =>
    setForm((s) => ({ ...s, mobile: { ...EMPTY_MOBILE, ...(s.mobile ?? {}), ...patch } }));
  const patchMoney = (patch: Partial<MoneyTransferDetails>) =>
    setForm((s) => ({ ...s, money: { ...EMPTY_MONEY, ...(s.money ?? {}), ...patch } }));
  const patchWallet = (patch: Partial<DebitWalletDetails>) =>
    setForm((s) => ({ ...s, wallet: { ...EMPTY_WALLET, ...(s.wallet ?? {}), ...patch } }));

  function onSave() {
    const missing = REQUIRED.filter((k) => !String(form[k] ?? "").trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((k) => [k, "This field is required."])));
      return;
    }
    setErrors({});
    // No persistence layer exists for institution configuration yet. The
    // previous version pushed straight into the imported mockPaymentMethods
    // array, which mutated module state every other screen reads from and
    // vanished on reload — worse than not saving, because it looked like
    // it had. Navigating back keeps the flow intact until a real endpoint
    // replaces this call.
    router.push("/institution/payment-methods");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Field label="Label" required error={errors.label}>
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
            <TextInput value={form.bank?.accountName ?? ""} onChange={(e) => patchBank({ accountName: e.target.value })} />
          </Field>
          <Field label="Account number">
            <TextInput value={form.bank?.accountNumber ?? ""} onChange={(e) => patchBank({ accountNumber: e.target.value })} />
          </Field>
          <Field label="Bank name">
            <TextInput value={form.bank?.bankName ?? ""} onChange={(e) => patchBank({ bankName: e.target.value })} />
          </Field>
          <Field label="SWIFT">
            <TextInput value={form.bank?.swift ?? ""} onChange={(e) => patchBank({ swift: e.target.value })} />
          </Field>
        </>
      )}

      {form.type === "mobile_operator" && (
        <>
          <Field label="Operator">
            <TextInput value={form.mobile?.operator ?? ""} onChange={(e) => patchMobile({ operator: e.target.value })} />
          </Field>
          <Field label="Number">
            <TextInput value={form.mobile?.number ?? ""} onChange={(e) => patchMobile({ number: e.target.value })} />
          </Field>
        </>
      )}

      {form.type === "money_transfer" && (
        <Field label="Provider / Instructions">
          <TextInput value={form.money?.instructions ?? ""} onChange={(e) => patchMoney({ instructions: e.target.value })} />
        </Field>
      )}

      {form.type === "debit_wallet" && (
        <>
          <Field label="Provider">
            <TextInput value={form.wallet?.provider ?? ""} onChange={(e) => patchWallet({ provider: e.target.value })} />
          </Field>
          <Field label="Wallet ID">
            <TextInput value={form.wallet?.walletId ?? ""} onChange={(e) => patchWallet({ walletId: e.target.value })} />
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
