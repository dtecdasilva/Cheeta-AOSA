"use client";

import Link from "next/link";
import { ArrowRight, Banknote, Landmark, Printer, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { FormError } from "@/components/Form";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import { ExchangeRateInfo } from "@/components/currency/ExchangeRateInfo";
import { useMyFees, useMyPaymentMethods } from "@/lib/fees/api";
import { PAYMENT_KINDS } from "@/lib/fees/paymentKinds";
import { describePaymentMethod, type PaymentMethodType, type PublicPaymentMethod } from "@/lib/institution/paymentMethods";
import { buttonClass } from "@/lib/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Every way the applicant can pay each institution, next to what's still
 * owed there. The amounts come from /api/student/fees (the same figures
 * as the Application Fee Summary) and the accounts from
 * /api/student/payment-methods: each institution's own payment methods,
 * and only the ones that are active and verified by Cheeta administration.
 */

const ICONS: Record<PaymentMethodType, LucideIcon> = { bank: Landmark, mobile_operator: Smartphone, money_transfer: Banknote, debit_wallet: Wallet };

export function PaymentOptions() {
  const tr = useT();
  const { fees, error, saving, setCurrency } = useMyFees();
  const methods = useMyPaymentMethods();

  if (!fees || !methods.loaded) {
    const problem = error ?? methods.error;
    return problem ? <FormError>{tr(problem)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading your payment options…")}</p>;
  }

  const { baseCurrency: base, displayCurrency: shown, totals } = fees;
  const accountsOf = (applicationId: string): PublicPaymentMethod[] => methods.institutions?.find((i) => i.applicationId === applicationId)?.methods ?? [];

  return (
    <div className="max-w-5xl space-y-8">
      <section>
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr("How paying works")}</p>
        <ol className="mt-3 grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3">
          {[
            [tr("Pay the institution"), tr("Use one of the accounts below. Quote your application reference so the payment can be matched.")],
            [tr("Record your payment"), tr("Add the transaction reference and upload the receipt under the method you used.")],
            [tr("Wait for approval"), tr("AOSA checks the payment, usually within 48 hours, and issues a bank code. Your application can then be submitted.")],
          ].map(([title, text], i) => (
            <li key={title} className="bg-[var(--color-surface)] px-5 py-4">
              <p className="text-xs text-[var(--color-ink-faint)]">{tr("Step")}{" "}{i + 1}</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{tr(title)}</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{tr(text)}</p>
            </li>
          ))}
        </ol>
      </section>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-ink-soft)]">{tr("Still to pay, all institutions")}</p>
            <p className="mt-1 font-bold tracking-tight text-3xl tabular-nums text-[var(--color-ink)]">
              <ConvertedAmount amount={totals.outstanding.base} fromCode={base} toCode={shown} converted={totals.outstanding.display} />
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
              {tr("You always pay in {base}; other currencies are shown for reference only.", { base })}{" "}
              <Link href="/student/fees/summary" className="underline underline-offset-4">
                {tr("See the full breakdown")}
              </Link>
            </p>
            {shown !== base && <ExchangeRateInfo className="mt-1" baseCode={base} code={shown} basePerUnit={fees.rate?.basePerUnit} source={fees.rate?.source} effectiveFrom={fees.rate?.effectiveFrom} unavailable={fees.conversionUnavailable} />}
          </div>
          <div className="w-full max-w-xs">
            <CurrencySelector label={tr("Show amounts in")} value={shown} onChange={setCurrency} disabled={saving} />
          </div>
        </div>
        {error && (
          <div className="mt-3">
            <FormError>{tr(error)}</FormError>
          </div>
        )}
      </Card>

      {fees.applications.length === 0 ? (
        <EmptyState
          message={tr("You haven't added an institution to your application yet. The ways to pay each one will appear here once you have.")}
          action={
            <Link href="/student/institutions/add" className={buttonClass("secondary")}>
              {tr("Add an institution")}
            </Link>
          }
        />
      ) : (
        <section className="space-y-5">
          {fees.applications.map((line) => {
            const accounts = accountsOf(line.id);
            const payable = line.state === "UNPAID" || line.state === "REJECTED";
            return (
              <Card key={line.id} padded={false}>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr(line.institution.name)}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{tr("Application reference {reference}", { reference: line.reference })}</p>
                  </div>
                  <div className="text-right">
                    {line.state === "PAID" ? (
                      <p className="text-sm font-medium text-[var(--color-success-strong)]">{tr("Paid in full")}</p>
                    ) : line.state === "AWAITING" ? (
                      <p className="text-sm font-medium text-[var(--color-info-strong)]">{tr("Payment awaiting approval")}</p>
                    ) : line.state === "UNPRICED" ? (
                      <p className="max-w-xs text-sm text-[var(--color-warning-strong)]">{tr(line.reason)}</p>
                    ) : (
                      <>
                        <p className="text-xs text-[var(--color-ink-faint)]">{line.state === "REJECTED" ? tr("To pay (last payment rejected)") : tr("To pay")}</p>
                        <p className="font-semibold tracking-tight text-xl tabular-nums text-[var(--color-ink)]">
                          <ConvertedAmount amount={line.total ?? 0} fromCode={line.currency} toCode={line.display?.currency} converted={line.display?.total} />
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <ul className="grid gap-px bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
                  {PAYMENT_KINDS.map((kind) => {
                    const offered = accounts.filter((a) => a.type === kind.type);
                    const Icon = ICONS[kind.type];
                    const on = offered.length > 0;
                    return (
                      <li key={kind.type} className="flex flex-col bg-[var(--color-surface)] px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${on ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`} strokeWidth={1.75} />
                          <p className={`text-sm font-medium ${on ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`}>{tr(kind.label)}</p>
                        </div>
                        {on ? (
                          <>
                            <p className="mt-1.5 flex-1 text-xs text-[var(--color-ink-soft)]">{[...new Set(offered.map((a) => a.provider))].join(", ")}</p>
                            {payable && (
                              <Link href={`/student/fees/payment/${kind.slug}?application=${encodeURIComponent(line.id)}`} className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--color-ink)] underline underline-offset-4">
                                {tr("Pay this way")}
                                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                              </Link>
                            )}
                          </>
                        ) : (
                          <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{tr("Not offered by this institution.")}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </section>
      )}

      {fees.applications.length > 0 && (
        <section className="print-area space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr("My Payment Options")}</p>
              <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-soft)]">
                {tr("Print this table and use it to pay each institution's application fee and the web fee, then come back to record your payment and submit your application.")}
              </p>
            </div>
            <button type="button" onClick={() => window.print()} className={`no-print ${buttonClass("secondary")}`}>
              <Printer className="h-4 w-4" /> {tr("Print")}
            </button>
          </div>
          {fees.applications.map((line) => {
            const accounts = accountsOf(line.id);
            return (
              <div key={line.id} className="break-inside-avoid rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
                <p className="font-medium text-[var(--color-ink)]">
                  {tr(line.institution.name)} <span className="text-sm font-normal text-[var(--color-ink-soft)]">· {tr("Application reference {reference}", { reference: line.reference })}</span>
                </p>
                {accounts.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{tr("This institution has no verified payment account yet.")}</p>
                ) : (
                  PAYMENT_KINDS.filter((k) => accounts.some((a) => a.type === k.type)).map((kind) => (
                    <div key={kind.type} className="mt-3">
                      <p className="text-sm font-medium text-[var(--color-ink)]">{tr(kind.label)}</p>
                      <div className="mt-1 overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {accounts
                              .filter((a) => a.type === kind.type)
                              .map((a) => (
                                <tr key={a.id} className="border-t border-[var(--color-line)] align-top">
                                  {describePaymentMethod(a).map((row) => (
                                    <td key={row.field} className="py-1.5 pr-4">
                                      <span className="block text-xs text-[var(--color-ink-faint)]">{tr(row.label)}</span>
                                      <span className={row.field === "accountNumber" || row.field === "rib" || row.field.endsWith("Code") ? "font-mono" : undefined}>{row.value}</span>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </section>
      )}

      <section>
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr("About each method")}</p>
        <dl className="mt-3 divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] text-sm">
          {PAYMENT_KINDS.map((kind) => (
            <div key={kind.type} className="flex flex-wrap justify-between gap-2 px-5 py-3">
              <dt className="text-[var(--color-ink)]">{tr(kind.label)}</dt>
              <dd className="text-[var(--color-ink-soft)]">{tr(kind.blurb)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
