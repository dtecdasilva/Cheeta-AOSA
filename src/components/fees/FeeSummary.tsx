"use client";

import Link from "next/link";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import { ExchangeRateInfo } from "@/components/currency/ExchangeRateInfo";
import { FormError } from "@/components/Form";
import { Card, EmptyState, TableFrame, Th, Td } from "@/components/ui";
import { useMyFees } from "@/lib/fees/api";
import type { FeeLine } from "@/lib/fees/types";
import { useMoneyFormat } from "@/lib/currency/useCurrencies";
import { formatDate } from "@/lib/utils";
import { buttonClass } from "@/lib/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * What each of the applicant's applications costs, from /api/student/fees.
 *
 * Every figure here was worked out by the server. What is owed is always
 * an amount in the base currency; the currency picker only changes what
 * the amounts are also shown in, and saves that choice. A line with a
 * payment recorded shows the figures stored with that payment, including
 * the converted amount as it was on the day, whatever the rates or the
 * chosen currency are now.
 */
export function FeeSummary() {
  const tr = useT();
  const { fees, error, saving, setCurrency } = useMyFees();

  if (!fees) return error ? <FormError>{tr(error)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading your fees…")}</p>;

  const { baseCurrency: base, displayCurrency: shown, applications, totals } = fees;
  const converting = shown !== base;

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <div className="max-w-xs">
          <CurrencySelector label={tr("Show fees in")} value={shown} onChange={setCurrency} disabled={saving} />
        </div>
        {converting && <ExchangeRateInfo className="mt-3" baseCode={base} code={shown} basePerUnit={fees.rate?.basePerUnit} source={fees.rate?.source} effectiveFrom={fees.rate?.effectiveFrom} unavailable={fees.conversionUnavailable} />}
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          {tr("What you owe is always the {base} amount.", { base })}{" "}{converting ? tr("The {shown} figures are for reference, at today's rate, and move with it until you pay.", { shown }) : tr("Choose another currency to see what it comes to.")}
        </p>
        {error && (
          <div className="mt-3">
            <FormError>{tr(error)}</FormError>
          </div>
        )}
      </Card>

      {applications.length === 0 ? (
        <EmptyState
          message={tr("You haven't added an institution to your application yet. Its fees will appear here once you have.")}
          action={
            <Link href="/student/institutions/add" className={buttonClass("secondary")}>
              {tr("Add an institution")}
            </Link>
          }
        />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Institution")}</Th>
              <Th>{tr("Application fee")}</Th>
              <Th>{tr("Web fee")}</Th>
              <Th>{tr("Total")}</Th>
              <Th>{tr("Payment")}</Th>
            </tr>
          </thead>
          <tbody>
            {applications.map((line) => (
              <FeeRow key={line.id} line={line} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <Td className="font-medium text-[var(--color-ink)]">{tr("Still to pay")}</Td>
              <Td colSpan={4}>
                <ConvertedAmount amount={totals.outstanding.base} fromCode={base} toCode={shown} converted={totals.outstanding.display} className="text-lg font-semibold tracking-tight text-[var(--color-ink)]" />
              </Td>
            </tr>
            {(totals.awaiting.base > 0 || totals.paid.base > 0) && (
              <tr>
                <Td className="text-[var(--color-ink-soft)]">{tr("Already recorded")}</Td>
                <Td colSpan={4} className="text-[var(--color-ink-soft)]">
                  <Recorded awaiting={totals.awaiting.base} paid={totals.paid.base} base={base} />
                </Td>
              </tr>
            )}
          </tfoot>
        </TableFrame>
      )}
    </div>
  );
}

function Recorded({ awaiting, paid, base }: { awaiting: number; paid: number; base: string }) {
  const tr = useT();
  const format = useMoneyFormat();
  const parts = [paid > 0 ? `${format(paid, base)} paid` : "", awaiting > 0 ? tr("{value} awaiting approval", { value: format(awaiting, base) }) : ""].filter(Boolean);
  return <>{parts.join(" · ")}</>;
}

function FeeRow({ line }: { line: FeeLine }) {
  const tr = useT();
  const format = useMoneyFormat();
  const base = line.currency;
  const d = line.display;
  // Set in another currency by the institution: say what it set, and the rate it became the base amount at.
  const scheduled = line.fee.currency !== base && line.fee.basePerUnit !== null;

  return (
    <tr>
      <Td className="text-[var(--color-ink)]">
        {line.institution.name}
        <div className="text-xs text-[var(--color-ink-faint)]">{line.reference}</div>
      </Td>
      <Td className="text-[var(--color-ink-soft)]">
        {line.applicationFee === null ? (
          <span>{format(line.fee.amount, line.fee.currency)}</span>
        ) : (
          <ConvertedAmount stacked amount={line.applicationFee} fromCode={base} toCode={d?.currency} converted={d?.applicationFee} />
        )}
        {scheduled && (
          <div className="text-xs text-[var(--color-ink-faint)]">
            {tr("Set as {value}, at", { value: format(line.fee.amount, line.fee.currency) })}{" "}{line.fee.basePerUnit!.toLocaleString("en-US", { maximumFractionDigits: 6 })} {tr("{base} per {currency}", { base, currency: line.fee.currency })}
          </div>
        )}
      </Td>
      <Td className="text-[var(--color-ink-soft)]">
        <ConvertedAmount stacked amount={line.webFee} fromCode={base} toCode={line.total === null ? null : d?.currency} converted={d?.webFee} />
      </Td>
      <Td className="text-[var(--color-ink)]">
        {line.total === null ? (
          <span className="text-[var(--color-ink-faint)]">—</span>
        ) : (
          <ConvertedAmount stacked amount={line.total} fromCode={base} toCode={d?.currency} converted={d?.total} className="text-sm font-semibold" />
        )}
        {line.locked && <div className="text-xs font-normal text-[var(--color-ink-faint)]">{d ? tr("At the rate when you recorded the payment") : tr("As recorded with your payment")}</div>}
      </Td>
      <Td className="text-[var(--color-ink-soft)]">
        <PaymentState line={line} />
      </Td>
    </tr>
  );
}

function PaymentState({ line }: { line: FeeLine }) {
  const tr = useT();
  const payLink = (label: string) => (
    <Link href="/student/fees/payment-options" className="mt-0.5 block text-xs underline underline-offset-4">
      {tr(label)}
    </Link>
  );
  switch (line.state) {
    case "PAID":
      return (
        <>
          <span className="font-medium text-[var(--color-success-strong)]">{tr("Paid")}</span>
          {line.payment?.bankCode && <div className="font-mono text-xs text-[var(--color-ink-soft)]">{tr("Bank code {bankCode}", { bankCode: line.payment.bankCode })}</div>}
        </>
      );
    case "AWAITING":
      return (
        <>
          <span className="font-medium text-[var(--color-info-strong)]">{tr("Awaiting approval")}</span>
          {line.payment && <div className="text-xs text-[var(--color-ink-faint)]">{tr("Recorded {value}", { value: formatDate(line.payment.submittedAt) })}</div>}
        </>
      );
    case "REJECTED":
      return (
        <>
          <span className="font-medium text-[var(--color-danger)]">{tr("Payment rejected")}</span>
          {line.payment?.rejectionReason && <div className="text-xs text-[var(--color-ink-soft)]">{tr(line.payment.rejectionReason)}</div>}
          {payLink(tr("Record it again"))}
        </>
      );
    case "UNPRICED":
      return (
        <>
          <span className="font-medium text-[var(--color-warning-strong)]">{tr("Amount not available yet")}</span>
          <div className="text-xs text-[var(--color-ink-soft)]">{tr(line.reason)}</div>
        </>
      );
    default:
      return (
        <>
          <span className="font-medium text-[var(--color-danger)]">{tr("Not paid")}</span>
          {payLink(tr("See how to pay"))}
        </>
      );
  }
}
