"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Landmark, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import { institutions } from "@/lib/data";
import { mockOtherFees, mockPaymentStatus } from "@/lib/mockData/fees";
import { getPaymentConfigForInstitution, type InstitutionPaymentConfig } from "@/lib/mockData/payments";

/**
 * Every way the applicant can pay each institution, next to what's still
 * owed there. Reads the same fee and payment data as the Application Fee
 * Summary so the two pages always agree.
 */

const BASE_CURRENCY = "XAF";

type MethodKey = "bank" | "mobile" | "transfer" | "wallet";

const METHODS: { key: MethodKey; label: string; href: string; icon: LucideIcon; blurb: string; available: (c: InstitutionPaymentConfig) => number }[] = [
  {
    key: "bank",
    label: "Bank account",
    href: "/student/fees/payment/bank-account",
    icon: Landmark,
    blurb: "Deposit or transfer at the bank. Clears in about 2 working days.",
    available: (c) => (c.bank ? 1 : 0),
  },
  {
    key: "mobile",
    label: "Mobile operator",
    href: "/student/fees/payment/mobile-operator",
    icon: Smartphone,
    blurb: "MTN Mobile Money or Orange Money. Usually instant.",
    available: (c) => c.mobileMoney?.length ?? 0,
  },
  {
    key: "transfer",
    label: "Money transfer",
    href: "/student/fees/payment/money-transfer",
    icon: Banknote,
    blurb: "Express Union, Western Union and similar agencies. Clears in a day.",
    available: (c) => c.moneyTransfer?.length ?? 0,
  },
  {
    key: "wallet",
    label: "Debit wallet",
    href: "/student/fees/payment/debit-wallet",
    icon: Wallet,
    blurb: "Pay from a digital wallet the institution accepts.",
    available: (c) => (c.debitWallet ? 1 : 0),
  },
];

function owedFor(instId: string, applicationFee: number, webFee: number) {
  const other = (mockOtherFees[instId] ?? []).reduce((s, o) => s + o.amount, 0);
  const total = applicationFee + webFee + other;
  const pay = mockPaymentStatus[instId] ?? { status: "UNPAID" as const };
  const balance = pay.status === "PAID" ? 0 : pay.status === "PARTIAL" ? Math.max(0, total - (pay.paidAmount ?? 0)) : total;
  return { total, balance, status: pay.status };
}

export function PaymentOptions() {
  const [currency, setCurrency] = useState(BASE_CURRENCY);
  const rows = institutions.map((inst) => ({ inst, config: getPaymentConfigForInstitution(inst.id), ...owedFor(inst.id, inst.applicationFee, inst.webFee) }));
  const outstanding = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="max-w-5xl space-y-8">
      <section>
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">How paying works</p>
        <ol className="mt-3 grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3">
          {[
            ["Pay the institution", "Use one of the accounts below. Quote your application reference so the payment can be matched."],
            ["Record your payment", "Add the transaction reference and upload the receipt under the method you used."],
            ["Wait for approval", "AOSA checks the payment, usually within 48 hours, and issues a bank code. Your application can then be submitted."],
          ].map(([title, text], i) => (
            <li key={title} className="bg-[var(--color-surface)] px-5 py-4">
              <p className="text-xs text-[var(--color-ink-faint)]">Step {i + 1}</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{title}</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-ink-soft)]">Still to pay, all institutions</p>
            <p className="mt-1 font-bold tracking-tight text-3xl tabular-nums text-[var(--color-ink)]">
              <ConvertedAmount amount={outstanding} fromCode={BASE_CURRENCY} toCode={currency} />
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
              You always pay in {BASE_CURRENCY}; other currencies are shown for reference only.{" "}
              <Link href="/student/fees/summary" className="underline underline-offset-4">
                See the full breakdown
              </Link>
            </p>
          </div>
          <div className="w-full max-w-xs">
            <CurrencySelector label="Show amounts in" value={currency} onChange={setCurrency} />
          </div>
        </div>
      </Card>

      <section className="space-y-5">
        {rows.map(({ inst, config, total, balance, status }) => (
          <Card key={inst.id} padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{inst.name}</p>
                <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{inst.location}</p>
              </div>
              <div className="text-right">
                {status === "PAID" ? (
                  <p className="text-sm font-medium text-[var(--color-success-strong)]">Paid in full</p>
                ) : (
                  <>
                    <p className="text-xs text-[var(--color-ink-faint)]">{status === "PARTIAL" ? "Balance to pay" : "To pay"}</p>
                    <p className="font-semibold tracking-tight text-xl tabular-nums text-[var(--color-ink)]">
                      <ConvertedAmount amount={balance} fromCode={BASE_CURRENCY} toCode={currency} />
                    </p>
                    {status === "PARTIAL" && (
                      <p className="text-xs text-[var(--color-ink-faint)]">
                        of <ConvertedAmount amount={total} fromCode={BASE_CURRENCY} toCode={BASE_CURRENCY} />
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <ul className="grid gap-px bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
              {METHODS.map((m) => {
                const count = config ? m.available(config) : 0;
                const Icon = m.icon;
                return (
                  <li key={m.key} className="flex flex-col bg-[var(--color-surface)] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${count ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`} strokeWidth={1.75} />
                      <p className={`text-sm font-medium ${count ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`}>{m.label}</p>
                    </div>
                    {count ? (
                      <>
                        <p className="mt-1.5 flex-1 text-xs text-[var(--color-ink-soft)]">{describe(m.key, config!)}</p>
                        {status !== "PAID" && (
                          <Link href={m.href} className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--color-ink)] underline underline-offset-4">
                            Pay this way
                            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                          </Link>
                        )}
                      </>
                    ) : (
                      <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">Not offered by this institution.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </section>

      <section>
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">About each method</p>
        <dl className="mt-3 divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] text-sm">
          {METHODS.map((m) => (
            <div key={m.key} className="flex flex-wrap justify-between gap-2 px-5 py-3">
              <dt className="text-[var(--color-ink)]">{m.label}</dt>
              <dd className="text-[var(--color-ink-soft)]">{m.blurb}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function describe(key: MethodKey, c: InstitutionPaymentConfig): string {
  switch (key) {
    case "bank":
      return `${c.bank!.bankName}${c.bank!.branch ? `, ${c.bank!.branch}` : ""}`;
    case "mobile":
      return c.mobileMoney!.map((m) => m.operator).join(" or ");
    case "transfer":
      return c.moneyTransfer!.map((m) => m.provider).join(", ");
    case "wallet":
      return c.debitWallet!.walletName;
  }
}
