"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, FormError, PrimaryButton, SelectInput, TextInput } from "@/components/Form";
import { Card, DescriptionList, EmptyState } from "@/components/ui";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import { recordPayment, useMyFees, useMyPaymentMethods } from "@/lib/fees/api";
import { PAYMENT_KINDS } from "@/lib/fees/paymentKinds";
import { PAYMENT_METHOD_CHANNEL, describePaymentMethod, type PaymentMethodType } from "@/lib/institution/paymentMethods";
import { buttonClass } from "@/lib/ui/button";
import { AmountDue, isPayable } from "./PaymentInstructions";
import { useT } from "@/lib/i18n/client";

/**
 * Records a payment the applicant has made outside the platform by one
 * kind of method: which application it is for, which of the institution's
 * accounts it went into, the reference, the date and the receipt.
 *
 * There is no amount field. The server works out what is owed and, when
 * the payment is recorded, fixes that amount and the exchange rates
 * behind it on the payment; the figures shown here before sending are
 * the server's current ones.
 */
export function PaymentSubmitForm({ type, application, account }: { type: PaymentMethodType; application?: string; account?: string }) {
  const tr = useT();
  const kind = PAYMENT_KINDS.find((k) => k.type === type)!;
  const { fees, error: feesError, reload } = useMyFees();
  const methods = useMyPaymentMethods(type);

  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);
  /** A field's message goes as soon as the field is changed. */
  const clear = (key: string) => setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));

  if (!fees || !methods.loaded) {
    const problem = feesError ?? methods.error;
    return problem ? <FormError>{tr(problem)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  }

  const accountsOf = (id: string) => methods.institutions?.find((i) => i.applicationId === id)?.methods ?? [];

  if (recorded) {
    const line = fees.applications.find((l) => l.id === recorded);
    return (
      <Card className="max-w-2xl">
        <p className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{tr("Payment recorded")}</p>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {tr("Cheeta administration will check it against the institution's account, usually within 48 hours. You will be notified when it is approved.")}
        </p>
        {line && line.total !== null && (
          <p className="mt-3 text-sm text-[var(--color-ink)]">
            {tr(line.institution.name)}: <ConvertedAmount amount={line.total} fromCode={line.currency} toCode={line.display?.currency} converted={line.display?.total} className="font-semibold" />
            <span className="block text-xs text-[var(--color-ink-faint)]">{tr("This amount is now fixed for this payment. Later exchange rates will not change it.")}</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/student/fees/summary" className={buttonClass("primary")}>
            {tr("View fee summary")}
          </Link>
          <Link href="/student/fees/payment-options" className={buttonClass("secondary")}>
            {tr("Pay another institution")}
          </Link>
        </div>
      </Card>
    );
  }

  // Applications that can be paid this way: still owing, and the institution has an account of this kind.
  const candidates = fees.applications.filter((l) => isPayable(l) && accountsOf(l.id).length > 0);
  const asked = fees.applications.find((l) => l.id === (applicationId ?? application));
  const line = (asked && candidates.includes(asked) ? asked : null) ?? (applicationId || !asked ? candidates[0] : null);

  if (!line) {
    // Either the application asked for can't be paid (already paid, awaiting, or not by this method), or none can.
    return (
      <div className="max-w-2xl space-y-4">
        {asked && <AmountDue line={asked} />}
        <EmptyState
          message={asked && isPayable(asked) ? tr("{name} doesn't take payment by {toLowerCase}.", { name: tr(asked.institution.name), toLowerCase: kind.label.toLowerCase() }) : asked ? tr("There is nothing to record for this application.") : tr("None of your unpaid applications can be paid by {toLowerCase}.", { toLowerCase: kind.label.toLowerCase() })}
          action={
            <Link href="/student/fees/payment-options" className={buttonClass("secondary")}>
              {tr("See your payment options")}
            </Link>
          }
        />
      </div>
    );
  }

  const accounts = accountsOf(line.id);
  const chosenAccount = accounts.find((a) => a.id === (accountId ?? account)) ?? accounts[0];
  const channel = methods.channels?.find((c) => c.channel === PAYMENT_METHOD_CHANNEL[type]);
  const referenceLabel = channel?.referenceLabel ?? kind.referenceLabel;
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!reference.trim()) next.reference = tr("Enter the {toLowerCase}.", { toLowerCase: referenceLabel.toLowerCase() });
    if (!paidAt) next.paidAt = tr("Enter the date you paid.");
    else if (paidAt > today) next.paidAt = tr("The payment date can't be in the future.");
    if (methods.requireReceipt && !receipt) next.receiptFileId = tr("Upload the receipt.");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length || sending) return;

    setSending(true);
    const result = await recordPayment(line!.id, { paymentMethodId: chosenAccount.id, reference: reference.trim(), paidAt, paidFrom: paidFrom.trim(), receipt });
    if (result.ok) {
      await reload();
      setRecorded(line!.id);
    } else {
      setErrors(result.fieldErrors);
      setFormError(Object.keys(result.fieldErrors).length ? tr("Fix the fields marked above to record the payment.") : result.error);
    }
    setSending(false);
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5" noValidate>
      <Card className="space-y-4">
        <Field label={tr("Institution")}>
          <SelectInput
            value={line.id}
            onChange={(e) => {
              setApplicationId(e.target.value);
              setAccountId(null);
            }}
          >
            {candidates.map((l) => (
              <option key={l.id} value={l.id}>
                {tr(l.institution.name)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={tr("Account you paid into")} error={errors.paymentMethodId}>
          <SelectInput value={chosenAccount.id} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {tr(a.label)} ({tr(a.provider)})
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">
          <DescriptionList items={describePaymentMethod(chosenAccount).map((row) => ({ label: row.label, value: row.value }))} />
        </div>
      </Card>

      <AmountDue line={line} />

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr(referenceLabel)} required error={errors.reference} hint={tr("Exactly as it appears on your receipt.")}>
            <TextInput
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                clear("reference");
              }}
              maxLength={80}
            />
          </Field>
          <Field label={tr("Payment date")} required error={errors.paidAt}>
            <TextInput
              type="date"
              max={today}
              value={paidAt}
              onChange={(e) => {
                setPaidAt(e.target.value);
                clear("paidAt");
              }}
            />
          </Field>
        </div>
        <Field label={tr(kind.paidFromLabel)} error={errors.paidFrom} hint={tr(kind.paidFromHint)}>
          <TextInput value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)} maxLength={120} />
        </Field>
        <Field label={tr(kind.receiptLabel)} required={methods.requireReceipt} error={errors.receiptFileId} hint={tr("A PDF or a photo (JPG or PNG).")}>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => {
              setReceipt(e.target.files?.[0] ?? null);
              clear("receiptFileId");
            }} className="block w-full text-sm text-[var(--color-ink-soft)] file:mr-3 file:rounded-lg file:border file:border-[var(--color-ink)] file:bg-[var(--color-surface)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--color-ink)]" />
        </Field>
      </Card>

      {formError && <FormError>{tr(formError)}</FormError>}
      <div className="flex items-center gap-3">
        <PrimaryButton type="submit" disabled={sending}>
          {sending ? tr("Recording…") : tr("Record payment")}
        </PrimaryButton>
        <Link href={`/student/fees/payment/${kind.slug}?application=${encodeURIComponent(line.id)}`} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
          {tr("Back to the account details")}
        </Link>
      </div>
    </form>
  );
}
