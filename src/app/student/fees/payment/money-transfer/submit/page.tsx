"use client";

import { useState } from "react";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { mockInstitutions } from "@/lib/mockData/institutions";
import { Field, TextInput, SelectInput, PrimaryButton } from "@/components/Form";
import { formatAmount } from "@/lib/currency/data";

export default function MoneyTransferSubmitPage() {
  const [institutionId, setInstitutionId] = useState(mockInstitutions[0].id);
  const [company, setCompany] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [beneficiaryNumber, setBeneficiaryNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setReceipt(e.target.files?.[0] ?? null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!beneficiary) nextErrors.beneficiary = "Beneficiary required";
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) nextErrors.amount = "Enter a valid amount";
    if (!date) nextErrors.date = "Transfer date required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = { method: "money", institutionId, company, beneficiary, beneficiaryNumber, amount, date, receiptName: receipt?.name ?? null, submittedAt: new Date().toISOString() };
    console.log("Mock payment submission (money transfer):", payload);
    setSubmitted(true);
  }

  return (
    <>
      <Topbar title="Submit Money Transfer" description="Provide money transfer details and upload the receipt." />
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

            <Field label="Company">
              <TextInput value={company} onChange={(e) => setCompany(e.target.value)} />
            </Field>

            <Field label="Beneficiary">
              <TextInput value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
            </Field>

            <Field label="Beneficiary number">
              <TextInput value={beneficiaryNumber} onChange={(e) => setBeneficiaryNumber(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" hint={errors.amount}>
                <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} />
                {amount && !isNaN(Number(amount)) && <div className="text-xs text-[var(--color-ink-faint)] mt-1">Preview: {formatAmount(Number(amount), "XAF")}</div>}
              </Field>
              <Field label="Transfer date">
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>

            <Field label="Transfer receipt">
              <input type="file" onChange={handleFile} className="mt-1" />
              {receipt && <div className="text-xs mt-1">Selected: {receipt.name}</div>}
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
