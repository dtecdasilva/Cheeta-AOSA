"use client";

import { useState } from "react";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { mockInstitutions } from "@/lib/mockData/institutions";
import { Field, TextInput, SelectInput, PrimaryButton } from "@/components/Form";
import { formatAmount } from "@/lib/currency/data";

export default function DebitWalletSubmitPage() {
  const [institutionId, setInstitutionId] = useState(mockInstitutions[0].id);
  const [walletOperator, setWalletOperator] = useState("");
  const [sendingAccount, setSendingAccount] = useState("");
  const [receivingAccount, setReceivingAccount] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!walletOperator) nextErrors.walletOperator = "Wallet operator required";
    if (!sendingAccount) nextErrors.sendingAccount = "Sending account required";
    if (!receivingAccount) nextErrors.receivingAccount = "Receiving account required";
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) nextErrors.amount = "Enter a valid amount";
    if (!date) nextErrors.date = "Transfer date required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = { method: "wallet", institutionId, walletOperator, sendingAccount, receivingAccount, referenceCode, amount, date, submittedAt: new Date().toISOString() };
    console.log("Mock payment submission (debit wallet):", payload);
    setSubmitted(true);
  }

  return (
    <>
      <Topbar title="Submit Debit Wallet Payment" description="Provide debit wallet transfer details." />
      <main className={PAGE_MAIN_CLASS}>
        <div className="max-w-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Institution">
              <SelectInput value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
                {mockInstitutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Wallet operator" hint={errors.walletOperator}>
              <TextInput value={walletOperator} onChange={(e) => setWalletOperator(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sending account" hint={errors.sendingAccount}>
                <TextInput value={sendingAccount} onChange={(e) => setSendingAccount(e.target.value)} />
              </Field>
              <Field label="Receiving account" hint={errors.receivingAccount}>
                <TextInput value={receivingAccount} onChange={(e) => setReceivingAccount(e.target.value)} />
              </Field>
            </div>

            <Field label="Reference code">
              <TextInput value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" hint={errors.amount}>
                <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} />
                {amount && !isNaN(Number(amount)) && <div className="text-xs text-[var(--color-ink-faint)] mt-1">Preview: {formatAmount(Number(amount), "XAF")}</div>}
              </Field>
              <Field label="Transfer date">
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {errors.date && <div className="text-xs text-[var(--color-danger)]">{errors.date}</div>}
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <PrimaryButton type="submit">Submit</PrimaryButton>
              {submitted && <div className="text-sm text-[var(--color-success)]">Submission recorded (mock).</div>}
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
