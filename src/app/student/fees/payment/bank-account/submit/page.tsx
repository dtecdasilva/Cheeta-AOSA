"use client";

import { useState } from "react";
import { Topbar } from "@/components/Topbar";
import { mockInstitutions } from "@/lib/mockData/institutions";
import { getPaymentConfigForInstitution } from "@/lib/mockData/payments";
import { Field, TextInput, SelectInput, PrimaryButton } from "@/components/Form";
import { formatAmount } from "@/lib/currency/data";

export default function BankAccountSubmitPage() {
  const [institutionId, setInstitutionId] = useState(mockInstitutions[0].id);
  const config = getPaymentConfigForInstitution(institutionId);

  const [bank, setBank] = useState(config?.bank?.bankName ?? "");
  const [account, setAccount] = useState(config?.bank?.accountNumber ?? "");
  const [bankCode, setBankCode] = useState("");
  const [branch, setBranch] = useState(config?.bank?.branch ?? "");
  const [rib, setRib] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSlipFile(f);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!bank) nextErrors.bank = "Bank is required";
    if (!account) nextErrors.account = "Account is required";
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) nextErrors.amount = "Enter a valid amount";
    if (!date) nextErrors.date = "Payment date required";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      method: "bank",
      institutionId,
      bank,
      account,
      bankCode,
      branch,
      rib,
      amount,
      date,
      slipFileName: slipFile?.name ?? null,
      submittedAt: new Date().toISOString(),
    };
    console.log("Mock payment submission (bank):", payload);
    setSubmitted(true);
  }

  return (
    <>
      <Topbar title="Submit Bank Account Payment" description="Provide bank deposit details and upload the payment slip." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-2xl mx-auto bg-white border p-6 rounded">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Institution">
              <SelectInput value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
                {mockInstitutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Bank" hint={errors.bank}>
              <TextInput value={bank} onChange={(e) => setBank(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Account" hint={errors.account}>
                <TextInput value={account} onChange={(e) => setAccount(e.target.value)} />
              </Field>
              <Field label="Bank code">
                <TextInput value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Branch">
                <TextInput value={branch} onChange={(e) => setBranch(e.target.value)} />
              </Field>
              <Field label="RIB">
                <TextInput value={rib} onChange={(e) => setRib(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" hint={errors.amount}>
                <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} />
                {amount && !isNaN(Number(amount)) && (
                  <div className="text-xs text-[var(--color-ink-faint)] mt-1">Preview: {formatAmount(Number(amount), "XAF")}</div>
                )}
              </Field>
              <Field label="Payment date" hint={errors.date}>
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>

            <Field label="Payment slip">
              <input type="file" onChange={handleFile} className="mt-1" />
              {slipFile && <div className="text-xs mt-1">Selected: {slipFile.name}</div>}
            </Field>

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
