"use client";

import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import {
  PAYMENT_METHOD_DETAIL_FIELDS,
  PAYMENT_METHOD_FIELDS,
  PAYMENT_METHOD_TYPES,
  PAYMENT_METHOD_TYPE_LABELS,
  validatePaymentMethodDetails,
  type PaymentMethod,
  type PaymentMethodDetailField,
  type PaymentMethodType,
} from "@/lib/institution/paymentMethods";
import { useRecordForm } from "./useRecordForm";

/**
 * Adds one of the institution's payment methods, or edits one. The detail
 * fields shown, what they are called and which are required follow the
 * kind chosen (src/lib/institution/paymentMethods.ts); the API applies the
 * same rules. Saved through /api/institution/payment-methods.
 */
export default function PaymentMethodForm({ initial }: { initial?: PaymentMethod }) {
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "payment-methods",
    "/institution/payment-methods",
    {
      type: (initial?.type ?? "bank") as PaymentMethodType,
      label: initial?.label ?? "",
      provider: initial?.provider ?? "",
      branch: initial?.branch ?? "",
      accountName: initial?.accountName ?? "",
      accountNumber: initial?.accountNumber ?? "",
      swift: initial?.swift ?? "",
      instructions: initial?.instructions ?? "",
      acceptsTuition: initial?.acceptsTuition ?? false,
      status: initial?.status ?? "ACTIVE",
    },
    initial?.id
  );
  const fields = PAYMENT_METHOD_FIELDS[form.type];
  // What the kind needs, checked here with the same function the API uses, so the messages are the same either way.
  const missing = validatePaymentMethodDetails(form);
  const required = Object.fromEntries(Object.entries(missing).filter(([field]) => !String(form[field as PaymentMethodDetailField]).trim())) as Partial<Record<PaymentMethodDetailField, string>>;

  function submit() {
    // On a new method the status isn't sent: it starts active, and waits to be verified either way.
    const { status, ...values } = form;
    void save({ label: "Enter a label for this method.", ...required }, initial ? { ...values, status } : values);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
        Cheeta administration checks every method before applicants are shown it.
        {initial ? " If you change the kind of method or any of its account details, it goes back to be checked and is hidden from applicants until it is verified again." : ""}
      </p>

      <Field label="Kind of method" required error={errors.type}>
        <SelectInput value={form.type} onChange={(e) => set("type", e.target.value as PaymentMethodType)}>
          {PAYMENT_METHOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {PAYMENT_METHOD_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Label" required error={errors.label} hint="What applicants see this method called, e.g. “Main bank account”.">
        <TextInput value={form.label} onChange={(e) => set("label", e.target.value)} maxLength={120} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {PAYMENT_METHOD_DETAIL_FIELDS.filter((f) => fields[f]).map((f) => {
          const rule = fields[f]!;
          return (
            <Field key={f} label={rule.label} required={rule.required} error={errors[f]} hint={rule.hint}>
              <TextInput value={form[f]} onChange={(e) => set(f, e.target.value)} placeholder={rule.placeholder} />
            </Field>
          );
        })}
      </div>

      <Field label="Instructions for payers" error={errors.instructions} hint="Shown to applicants with the account details.">
        <TextArea rows={3} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Use your application reference as the payment reference." maxLength={1000} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
        <input type="checkbox" checked={form.acceptsTuition} onChange={(e) => set("acceptsTuition", e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
        Also accept tuition payments into this account
      </label>

      {initial && (
        <Field label="Status" error={errors.status}>
          <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as "ACTIVE" | "INACTIVE")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectInput>
        </Field>
      )}

      {formError && <FormError>{formError}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
        <SecondaryButton onClick={back}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
