"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, FormError, SelectInput } from "@/components/Form";
import { Card, CardHeader, DescriptionList, EmptyState } from "@/components/ui";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import { useMyFees, useMyPaymentMethods } from "@/lib/fees/api";
import { PAYMENT_KINDS, type PaymentKind } from "@/lib/fees/paymentKinds";
import type { FeeLine } from "@/lib/fees/types";
import { describePaymentMethod } from "@/lib/institution/paymentMethods";
import { buttonClass } from "@/lib/ui/button";
import { useT } from "@/lib/i18n/client";

/** The names the four pages have always passed for the kind of method. */
const KIND_OF = { bank: "bank", mobile: "mobile_operator", money: "money_transfer", wallet: "debit_wallet" } as const;

/**
 * Where to pay one institution by one kind of method: the accounts that
 * institution has set up for it (verified by Cheeta administration), the
 * amount owed there, and the way on to recording the payment.
 *
 * `application` preselects one of the applicant's applications, as the
 * Payment Options page links here.
 */
export default function PaymentInstructions({ method, application }: { method: keyof typeof KIND_OF; application?: string }) {
  const tr = useT();
  const kind = PAYMENT_KINDS.find((k) => k.type === KIND_OF[method])!;
  const { fees, error } = useMyFees();
  const methods = useMyPaymentMethods(kind.type);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!fees || !methods.loaded) {
    const problem = error ?? methods.error;
    return problem ? <FormError>{tr(problem)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  }
  if (fees.applications.length === 0) {
    return (
      <EmptyState
        message={tr("You haven't added an institution to your application yet, so there is nothing to pay.")}
        action={
          <Link href="/student/institutions/add" className={buttonClass("secondary")}>
            {tr("Add an institution")}
          </Link>
        }
      />
    );
  }

  const accountsOf = (id: string) => methods.institutions?.find((i) => i.applicationId === id)?.methods ?? [];
  // Start on the application asked for; failing that, the first one that can be paid this way.
  const fallback = fees.applications.find((l) => accountsOf(l.id).length > 0 && isPayable(l)) ?? fees.applications.find((l) => accountsOf(l.id).length > 0) ?? fees.applications[0];
  const line = fees.applications.find((l) => l.id === (chosen ?? application)) ?? fallback;
  const accounts = accountsOf(line.id);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="max-w-sm">
        <Field label={tr("Select institution")}>
          <SelectInput value={line.id} onChange={(e) => setChosen(e.target.value)}>
            {fees.applications.map((l) => (
              <option key={l.id} value={l.id}>
                {tr(l.institution.name)}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <AmountDue line={line} />

      {accounts.length === 0 ? (
        <EmptyState
          message={tr("{name} doesn't take payment by {toLowerCase}.", { name: tr(line.institution.name), toLowerCase: kind.label.toLowerCase() })}
          action={
            <Link href="/student/fees/payment-options" className={buttonClass("secondary")}>
              {tr("See the ways it can be paid")}
            </Link>
          }
        />
      ) : (
        accounts.map((account) => (
          <Card key={account.id} padded={false}>
            <CardHeader title={tr(account.label)} description={tr(kind.label)} />
            <DescriptionList items={describePaymentMethod(account).map((row) => ({ label: row.label, value: <span className={row.field === "accountNumber" || row.field === "swift" ? "font-mono" : undefined}>{row.value}</span> }))} />
            {account.instructions && <p className="border-t border-[var(--color-line)] px-5 py-3 text-sm text-[var(--color-ink-soft)]">{tr(account.instructions)}</p>}
            {isPayable(line) && (
              <div className="border-t border-[var(--color-line)] px-5 py-3">
                <Link href={submitHref(kind, line.id, account.id)} className={buttonClass("primary")}>
                  {tr("I've paid: record this payment")}
                </Link>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

export const isPayable = (line: FeeLine) => line.state === "UNPAID" || line.state === "REJECTED";

export const submitHref = (kind: PaymentKind, applicationId: string, accountId: string) => `/student/fees/payment/${kind.slug}/submit?application=${encodeURIComponent(applicationId)}&account=${encodeURIComponent(accountId)}`;

/** What is owed on one application, or why nothing is to be paid now. */
export function AmountDue({ line }: { line: FeeLine }) {
  const tr = useT();
  const tone = line.state === "PAID" ? "text-[var(--color-success-strong)]" : line.state === "AWAITING" ? "text-[var(--color-info-strong)]" : "text-[var(--color-warning-strong)]";
  return (
    <Card>
      <p className="text-sm text-[var(--color-ink-soft)]">
        {tr("{name} · application reference", { name: tr(line.institution.name) })}{" "}<span className="font-medium text-[var(--color-ink)]">{line.reference}</span>
      </p>
      {isPayable(line) ? (
        <>
          <p className="mt-2 text-xs text-[var(--color-ink-faint)]">{tr("Amount to pay")}</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-[var(--color-ink)]">
            <ConvertedAmount amount={line.total ?? 0} fromCode={line.currency} toCode={line.display?.currency} converted={line.display?.total} />
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
            {tr("Pay the {currency} amount exactly, and quote your application reference.", { currency: line.currency })}
            {line.state === "REJECTED" && line.payment?.rejectionReason ? tr(" Your last payment was rejected: {rejectionReason}", { rejectionReason: line.payment.rejectionReason }) : ""}
          </p>
        </>
      ) : (
        <p className={`mt-2 text-sm font-medium ${tone}`}>
          {line.state === "PAID" ? tr("This application fee has been paid.") : line.state === "AWAITING" ? tr("A payment for this application is awaiting approval. There is nothing more to pay.") : line.reason}
        </p>
      )}
    </Card>
  );
}
