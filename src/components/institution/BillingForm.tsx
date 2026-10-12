"use client";

import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { useOptions } from "@/lib/institution/api";
import { FEE_CATEGORIES, FEE_CATEGORY_LABELS, FEE_TYPES, FEE_TYPE_LABELS, type Fee, type FeeCategory, type FeeType } from "@/lib/institution/fees";
import { useRecordForm } from "./useRecordForm";

/**
 * Adds a fee to the institution's schedule, or edits one. A change of
 * price is best added as a new fee with its own start date, so the
 * earlier one stays on record. Saved through /api/institution/fees.
 */
export default function BillingForm({ initial }: { initial?: Fee }) {
  const currencies = useOptions<{ code: string; name: string }>("/api/reference/currencies");
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "fees",
    "/institution/billing",
    {
      name: initial?.name ?? "",
      type: (initial?.type ?? "application") as FeeType,
      category: (initial?.category ?? "national") as FeeCategory,
      currency: initial?.currency ?? "XAF",
      amount: initial ? String(initial.amount) : "",
      effectiveDate: initial?.effectiveDate ?? "",
      effectiveTo: initial?.effectiveTo ?? "",
      notes: initial?.notes ?? "",
    },
    initial?.id
  );
  // Until the list arrives, at least the fee's own currency is there to show.
  const offered = currencies.length ? currencies : [{ code: form.currency, name: "" }];

  return (
    <div className="max-w-2xl space-y-4">
      <Field label="Fee name" required error={errors.name}>
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Application fee 2026/2027" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required error={errors.type}>
          <SelectInput value={form.type} onChange={(e) => set("type", e.target.value as FeeType)}>
            {FEE_TYPES.map((t) => (
              <option key={t} value={t}>
                {FEE_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Applies to" required error={errors.category} hint="National or international applicants.">
          <SelectInput value={form.category} onChange={(e) => set("category", e.target.value as FeeCategory)}>
            {FEE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {FEE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Currency" required error={errors.currency}>
          <SelectInput value={form.currency} onChange={(e) => set("currency", e.target.value)}>
            {offered.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name ? `${c.code} — ${c.name}` : c.code}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Amount" required error={errors.amount}>
          <TextInput type="number" min={0} step={1} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
        </Field>
        <Field label="Effective from" required error={errors.effectiveDate} hint="First day the fee applies.">
          <TextInput type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
        </Field>
        <Field label="Effective until" error={errors.effectiveTo} hint="Last day it applies. Leave empty for no end date.">
          <TextInput type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} />
        </Field>
      </div>
      <Field label="Notes" error={errors.notes}>
        <TextInput value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      {formError && <FormError>{formError}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton
          disabled={saving}
          onClick={() => save({ name: "Enter a name for the fee.", amount: "Enter the amount.", effectiveDate: "Enter the date the fee starts to apply." }, { ...form, amount: Number(form.amount), effectiveTo: form.effectiveTo || null })}
        >
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
        <SecondaryButton onClick={back}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
