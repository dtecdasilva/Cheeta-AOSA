"use client";

import { useState } from "react";
import { Topbar } from "@/components/Topbar";
import { mockInstitutions } from "@/lib/mockData/institutions";
import { Field, TextInput, SelectInput, PrimaryButton } from "@/components/Form";
import { formatAmount } from "@/lib/currency/data";

export default function MobileOperatorSubmitPage() {
  const [institutionId, setInstitutionId] = useState(mockInstitutions[0].id);
  const [operator, setOperator] = useState("");
  const [sendingPhone, setSendingPhone] = useState("");
  const [receivingPhone, setReceivingPhone] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!sendingPhone) nextErrors.sendingPhone = "Sending phone required";
    if (!receivingPhone) nextErrors.receivingPhone = "Receiving phone required";
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) nextErrors.amount = "Enter a valid amount";
    if (!date) nextErrors.date = "Transfer date required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = { method: "mobile", institutionId, operator, sendingPhone, receivingPhone, referenceCode, amount, date, submittedAt: new Date().toISOString() };
    console.log("Mock payment submission (mobile):", payload);
    setSubmitted(true);
  }

  return (
    <>
      <Topbar title="Submit Mobile Operator Transfer" description="Provide mobile transfer details." />
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

            <Field label="Operator">
              <TextInput value={operator} onChange={(e) => setOperator(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Sending phone" hint={errors.sendingPhone}>
                  <TextInput value={sendingPhone} onChange={(e) => setSendingPhone(e.target.value)} />
                </Field>
                <Field label="Receiving phone" hint={errors.receivingPhone}>
                  <TextInput value={receivingPhone} onChange={(e) => setReceivingPhone(e.target.value)} />
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
