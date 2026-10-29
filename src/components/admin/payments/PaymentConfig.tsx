"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeading } from "@/components/ui";
import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { InstitutionWebFees } from "@/components/admin/payments/InstitutionWebFees";
import { DeliberationSubscriptions } from "@/components/admin/payments/DeliberationSubscriptions";
import { PAYMENT_DEFAULTS, paymentSettingsStore, type PaymentSettings } from "@/lib/admin/settings";
import { parameterStore, sortParams } from "@/lib/admin/parameters";
import { BASE_CURRENCY, currencyStore } from "@/lib/admin/reference";
import { useT } from "@/lib/i18n/client";
import { DELIBERATION_ENABLED } from "@/lib/features";

/**
 * An amount in francs that may be left empty. Empty means "not decided
 * yet" (null), which is different from 0 ("free").
 */
function OptionalAmount({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const tr = useT();
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step={500}
        inputMode="numeric"
        aria-label={tr("{label}, in XAF", { label })}
        placeholder={tr("Not set")}
        value={value === null || Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/25"
      />
      <span className="text-sm text-[var(--color-ink-soft)]">XAF</span>
    </div>
  );
}

const amountProblem = (v: number | null) => (v !== null && (!Number.isInteger(v) || v < 0) ? "Enter a whole number of francs, 0 or more, or leave it empty." : undefined);

/**
 * Platform-wide money settings, stored in the database: the web fee,
 * what institutions pay to deliberate, where the web fee is collected,
 * which payment channels applicants may use, and the rules the AOSA
 * payments desk follows when approving payments.
 */
export function PaymentConfig() {
  const tr = useT();
  const params = parameterStore.useItems();
  const methodTypes = sortParams(params.filter((p) => p.category === "payment-method-types" && p.status === "ACTIVE"));
  const currencies = currencyStore.useItems().filter((c) => c.status === "ACTIVE");
  const platformWebFee = { ...PAYMENT_DEFAULTS, ...paymentSettingsStore.useItems()[0] }.defaultWebFee;
  // Payments awaiting approval right now, from the payments desk's own totals (/api/admin/fee-payments).
  const [awaiting, setAwaiting] = useState(0);
  useEffect(() => {
    fetch("/api/admin/fee-payments?pageSize=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b?.summary?.awaiting && setAwaiting(b.summary.awaiting.count))
      .catch(() => undefined);
  }, []);

  return (
    <>
      <PageHeading
        title={tr("Payment configuration")}
        description={tr("Platform-wide fees and the rules for payments. No money moves on the platform; these settings govern what is charged and how payments made elsewhere are recorded and approved.")}
      />
      <SettingsEditor<PaymentSettings>
        store={paymentSettingsStore}
        defaults={PAYMENT_DEFAULTS}
        validate={(d) => ({
          allowedMethodIds: d.allowedMethodIds.length === 0 ? tr("Allow at least one payment channel.") : undefined,
          bankCodePrefix: !/^[A-Z0-9]{2,6}$/.test(d.bankCodePrefix) ? tr("2 to 6 capital letters or digits.") : undefined,
          deliberationSubscriptionFee: amountProblem(d.deliberationSubscriptionFee),
          deliberationPerNameFee: amountProblem(d.deliberationPerNameFee),
        })}
        sections={[
          {
            title: tr("Currency and web fee"),
            fields: [
              {
                key: "baseCurrency",
                label: tr("Base currency"),
                kind: "select",
                // One choice: it is fixed. Other currencies are for display, or for an institution to set a fee in.
                options: currencies.filter((c) => c.code === BASE_CURRENCY).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
                hint: tr("Fixed. Everything owed is counted and stored in this currency; a fee set in another currency is converted to it at the exchange rate, and applicants can view amounts in a currency of their choice."),
              },
              {
                key: "defaultWebFee",
                label: tr("Platform web fee"),
                suffix: "XAF",
                kind: "number",
                required: true,
                min: 0,
                max: 100000,
                step: 500,
                hint: tr("What applicants pay the platform on top of an institution's application fee. Applies to every institution that doesn't have a web fee of its own (see Web fee by institution, below)."),
              },
            ],
          },
          {
            title: tr("Deliberation fees"),
            // Switched off until deliberation is released (src/lib/features.ts); the saved prices are kept.
            hidden: !DELIBERATION_ENABLED,
            description:
              tr("Deliberation is a paid service for institutions. Every institution sees its Deliberation List and can reject applications, but admitting applicants through the platform needs a subscription. Leave a price empty until it has been decided: no institution can subscribe until both are set. Enter 0 for no charge."),
            fields: [
              {
                key: "deliberationSubscriptionFee",
                label: tr("Annual subscription fee"),
                kind: "custom",
                hint: tr("Paid once a year by each institution that wants to deliberate."),
                render: (value, set) => <OptionalAmount label={tr("Annual subscription fee")} value={value as number | null} onChange={(v) => set(v as PaymentSettings[keyof PaymentSettings])} />,
              },
              {
                key: "deliberationPerNameFee",
                label: tr("Fee per applicant name"),
                kind: "custom",
                hint: tr("Charged for each applicant on a subscribed institution's Deliberation List. A subscription keeps the fee it started with."),
                render: (value, set) => <OptionalAmount label={tr("Fee per applicant name")} value={value as number | null} onChange={(v) => set(v as PaymentSettings[keyof PaymentSettings])} />,
              },
            ],
          },
          {
            title: tr("Web fee collection account"),
            description: tr("The account applicants pay the platform's web fee into. Institutions never see this amount."),
            fields: [
              { key: "webFeeCollectionBank", label: tr("Bank"), kind: "text" },
              { key: "webFeeAccountName", label: tr("Account name"), kind: "text" },
              { key: "webFeeAccountNumber", label: tr("Account number / IBAN"), kind: "text", wide: true },
            ],
          },
          {
            title: tr("Payment channels"),
            fields: [
              {
                key: "allowedMethodIds",
                label: tr("Channels applicants may use"),
                kind: "custom",
                hint: tr("Channel types are defined under Application parameters → Payment method types. Institutions add their own accounts for each."),
                render: (value, set) => {
                  const ids = value as string[];
                  return (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {methodTypes.map((m) => (
                        <label key={m.id} className="flex items-start gap-2.5 rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)]">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
                            checked={ids.includes(m.id)}
                            onChange={(e) => set((e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id)) as PaymentSettings[keyof PaymentSettings])}
                          />
                          <span>
                            {tr(m.label)}
                            <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">{tr("Clears in {value} days", { value: String(m.attrs.clearanceDays) })}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                },
              },
              { key: "allowPartialPayments", label: tr("Partial payments"), kind: "checkbox", checkboxLabel: tr("Accept partial payments of the application fee") },
            ],
          },
          {
            title: tr("Approval rules"),
            description: awaiting === 1 ? tr("The payments desk works through these. 1 payment is awaiting approval now.") : tr("The payments desk works through these. {count} payments are awaiting approval now.", { count: awaiting }),
            fields: [
              { key: "requireReceipt", label: tr("Receipt"), kind: "checkbox", checkboxLabel: tr("Require a receipt upload with every payment"), wide: true },
              { key: "approvalTargetHours", label: tr("Target time to approve"), suffix: "hours", kind: "number", required: true, min: 1, max: 336 },
              { key: "autoRejectAfterDays", label: tr("Reject unconfirmed payments after"), suffix: "days", kind: "number", required: true, min: 1, max: 90 },
              { key: "bankCodePrefix", label: tr("Bank code prefix"), kind: "text", required: true, hint: tr("Starts every bank code issued on approval.") },
              { key: "refundWindowDays", label: tr("Refund requests accepted for"), suffix: "days", kind: "number", required: true, min: 0, max: 365 },
            ],
          },
        ]}
        aside={
          <Card>
            <p className="font-semibold text-base text-[var(--color-ink)]">{tr("Related")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/admin/payments" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Application fee payments")}
                </Link>
                <span className="ml-2 text-[var(--color-ink-soft)]">{tr("{awaiting} awaiting", { awaiting })}</span>
              </li>
              <li>
                <Link href="/admin/payment-methods" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Institution payment methods")}
                </Link>
              </li>
              <li>
                <Link href="/admin/parameters/application/fee-types" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Fee types")}
                </Link>
              </li>
            </ul>
          </Card>
        }
      />

      <InstitutionWebFees platformFee={platformWebFee} />
      {DELIBERATION_ENABLED && <DeliberationSubscriptions />}
    </>
  );
}
