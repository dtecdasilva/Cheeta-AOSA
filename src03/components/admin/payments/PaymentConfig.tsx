"use client";

import Link from "next/link";
import { Card, PageHeading, SectionHeading, TableFrame, Td, Th } from "@/components/ui";
import { ActiveBadge } from "@/components/admin/ui";
import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { PAYMENT_DEFAULTS, paymentSettingsStore, type PaymentSettings } from "@/lib/admin/settings";
import { parameterStore, sortParams } from "@/lib/admin/parameters";
import { currencyStore } from "@/lib/admin/reference";
import { institutionStore } from "@/lib/admin/institutions";
import { paymentMethodStore } from "@/lib/admin/paymentMethods";
import { feePaymentStore } from "@/lib/payments/applicationFees";
import { formatCurrency } from "@/lib/utils";

/**
 * How application fee payments work platform-wide: where the web fee is
 * collected, which payment channels applicants may use, and the rules the
 * AOSA payments desk follows when approving them.
 */
export function PaymentConfig() {
  const params = parameterStore.useItems();
  const methodTypes = sortParams(params.filter((p) => p.category === "payment-method-types" && p.status === "ACTIVE"));
  const currencies = currencyStore.useItems().filter((c) => c.status === "ACTIVE");
  const institutions = [...institutionStore.useItems()].sort((a, b) => a.name.localeCompare(b.name));
  const methods = paymentMethodStore.useItems();
  const fees = feePaymentStore.useItems();
  const awaiting = fees.filter((f) => f.approval === "AWAITING").length;

  return (
    <>
      <PageHeading
        title="Payment configuration"
        description="Platform-wide rules for application fee payments. No money moves on the platform; these settings govern how payments made elsewhere are recorded and approved."
      />
      <SettingsEditor<PaymentSettings>
        store={paymentSettingsStore}
        defaults={PAYMENT_DEFAULTS}
        validate={(d) => ({
          allowedMethodIds: d.allowedMethodIds.length === 0 ? "Allow at least one payment channel." : undefined,
          bankCodePrefix: !/^[A-Z0-9]{2,6}$/.test(d.bankCodePrefix) ? "2 to 6 capital letters or digits." : undefined,
        })}
        sections={[
          {
            title: "Currency and web fee",
            fields: [
              {
                key: "baseCurrency",
                label: "Base currency",
                kind: "select",
                options: currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
                hint: "Every fee is entered and stored in this currency.",
              },
              { key: "defaultWebFee", label: "Default web fee", suffix: "XAF", kind: "number", required: true, min: 0, max: 100000, step: 500, hint: "Pre-filled for new institutions. Each institution can be set individually." },
            ],
          },
          {
            title: "Web fee collection account",
            description: "The account applicants pay the platform's web fee into. Institutions never see this amount.",
            fields: [
              { key: "webFeeCollectionBank", label: "Bank", kind: "text", required: true },
              { key: "webFeeAccountName", label: "Account name", kind: "text", required: true },
              { key: "webFeeAccountNumber", label: "Account number / IBAN", kind: "text", required: true, wide: true },
            ],
          },
          {
            title: "Payment channels",
            fields: [
              {
                key: "allowedMethodIds",
                label: "Channels applicants may use",
                kind: "custom",
                hint: "Channel types are defined under Application parameters → Payment method types. Institutions add their own accounts for each.",
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
                            {m.label}
                            <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">Clears in {String(m.attrs.clearanceDays)} days</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                },
              },
              { key: "allowPartialPayments", label: "Partial payments", kind: "checkbox", checkboxLabel: "Accept partial payments of the application fee" },
            ],
          },
          {
            title: "Approval rules",
            description: `The payments desk works through these. ${awaiting} payment${awaiting === 1 ? " is" : "s are"} awaiting approval now.`,
            fields: [
              { key: "requireReceipt", label: "Receipt", kind: "checkbox", checkboxLabel: "Require a receipt upload with every payment", wide: true },
              { key: "approvalTargetHours", label: "Target time to approve", suffix: "hours", kind: "number", required: true, min: 1, max: 336 },
              { key: "autoRejectAfterDays", label: "Reject unconfirmed payments after", suffix: "days", kind: "number", required: true, min: 1, max: 90 },
              { key: "bankCodePrefix", label: "Bank code prefix", kind: "text", required: true, hint: "Starts every bank code issued on approval." },
              { key: "refundWindowDays", label: "Refund requests accepted for", suffix: "days", kind: "number", required: true, min: 0, max: 365 },
            ],
          },
        ]}
        aside={
          <Card>
            <p className="font-semibold text-base text-[var(--color-ink)]">Related</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/admin/payments" className="text-[var(--color-ink)] underline underline-offset-4">
                  Application fee payments
                </Link>
                <span className="ml-2 text-[var(--color-ink-soft)]">{awaiting} awaiting</span>
              </li>
              <li>
                <Link href="/admin/payment-methods" className="text-[var(--color-ink)] underline underline-offset-4">
                  Institution payment methods
                </Link>
              </li>
              <li>
                <Link href="/admin/parameters/application/fee-types" className="text-[var(--color-ink)] underline underline-offset-4">
                  Fee types
                </Link>
              </li>
            </ul>
          </Card>
        }
      />

      <section className="mt-10">
        <SectionHeading title="Fees by institution" description="The application fee and web fee each institution charges. Edit an institution to change its web fee." />
        <TableFrame>
          <thead>
            <tr>
              <Th>Institution</Th>
              <Th className="text-right">Web fee</Th>
              <Th className="text-right">Active payment methods</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {institutions.map((i) => {
              const count = methods.filter((m) => m.institutionId === i.id && m.status === "ACTIVE" && m.verification === "VERIFIED").length;
              return (
                <tr key={i.id}>
                  <Td className="text-[var(--color-ink)]">{i.name}</Td>
                  <Td className="text-right tabular-nums">{formatCurrency(i.webFee)}</Td>
                  <Td className={`text-right tabular-nums ${count === 0 && i.status === "ACTIVE" ? "text-[var(--color-danger)]" : ""}`}>{count}</Td>
                  <Td>
                    <ActiveBadge active={i.status === "ACTIVE"} />
                  </Td>
                  <Td className="text-right">
                    <Link href={`/admin/institutions/${i.id}/edit`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                      Edit
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      </section>
    </>
  );
}
