"use client";

import { useState } from "react";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import { ExchangeRateInfo } from "@/components/currency/ExchangeRateInfo";
import { institutions } from "@/lib/data";
import { mockOtherFees, mockPaymentStatus, OtherFee } from "@/lib/mockData/fees";
import { Card, TableFrame, Th, Td } from "@/components/ui";

// Fees are entered and stored in XAF throughout this platform (see
// src/lib/data.ts) — this page lets an applicant VIEW that same data in
// a currency of their choosing. It does not change what's actually owed
// or process any payment; "Do not implement real payment conversion yet"
// means this is a display feature only.
const BASE_CURRENCY = "XAF";

export function FeeSummary() {
  const [displayCurrency, setDisplayCurrency] = useState(BASE_CURRENCY);

  const baseTotal = institutions.reduce((sum, i) => sum + i.applicationFee + i.webFee, 0);
  const otherTotal = Object.values(mockOtherFees)
    .flat()
    .reduce((sum, o) => sum + o.amount, 0);
  const grandTotal = baseTotal + otherTotal;

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <div className="max-w-xs">
          <CurrencySelector label="Show fees in" value={displayCurrency} onChange={setDisplayCurrency} />
        </div>
        {displayCurrency !== BASE_CURRENCY && (
          <div className="mt-3">
            <ExchangeRateInfo fromCode={BASE_CURRENCY} toCode={displayCurrency} />
          </div>
        )}
      </Card>

      <TableFrame>
          <thead>
            <tr>
              <Th>Institution</Th>
              <Th>Application</Th>
              <Th>Web/Admin</Th>
              <Th>Other fees</Th>
              <Th>Total</Th>
              <Th>Payment status</Th>
            </tr>
          </thead>
          <tbody>
            {institutions.map((inst) => {
              const other: OtherFee[] = mockOtherFees[inst.id] ?? [];
              const otherSum = other.reduce((sum, o) => sum + o.amount, 0);
              const instTotal = inst.applicationFee + inst.webFee + otherSum;
              const pay = mockPaymentStatus[inst.id] ?? { status: "UNPAID" as const };

              return (
                <tr key={inst.id}>
                  <Td className="text-[var(--color-ink)]">{inst.name}</Td>
                  <Td className="text-[var(--color-ink-soft)]">
                    <ConvertedAmount amount={inst.applicationFee} fromCode={BASE_CURRENCY} toCode={displayCurrency} />
                  </Td>
                  <Td className="text-[var(--color-ink-soft)]">
                    <ConvertedAmount amount={inst.webFee} fromCode={BASE_CURRENCY} toCode={displayCurrency} />
                  </Td>
                  <Td className="text-[var(--color-ink-soft)]">
                    {other.length ? (
                      <div>
                        <div className="text-[var(--color-ink)] font-medium">{otherSum > 0 ? <ConvertedAmount amount={otherSum} fromCode={BASE_CURRENCY} toCode={displayCurrency} /> : "—"}</div>
                        <div className="text-xs text-[var(--color-ink-faint)]">
                          {other.map((o) => (
                            <div key={o.id}>{o.label}: <ConvertedAmount amount={o.amount} fromCode={BASE_CURRENCY} toCode={displayCurrency} /></div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[var(--color-ink-faint)]">—</div>
                    )}
                  </Td>
                  <Td className="text-[var(--color-ink)]">
                    <ConvertedAmount amount={instTotal} fromCode={BASE_CURRENCY} toCode={displayCurrency} className="font-[var(--font-display)] text-sm" />
                  </Td>
                  <Td className="text-[var(--color-ink-soft)]">
                    {pay.status === "PAID" && <span className="text-[var(--color-success)] font-medium">Paid</span>}
                    {pay.status === "PARTIAL" && <span className="text-[var(--color-amber)] font-medium">Partially paid ({pay.paidAmount ?? "—"})</span>}
                    {pay.status === "UNPAID" && <span className="text-[var(--color-danger)] font-medium">Not paid</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <Td className="font-medium text-[var(--color-ink)]">Total (all institutions)</Td>
              <Td colSpan={5}>
                <ConvertedAmount
                  amount={grandTotal}
                  fromCode={BASE_CURRENCY}
                  toCode={displayCurrency}
                  className="font-[var(--font-display)] text-lg text-[var(--color-ink)]"
                />
              </Td>
            </tr>
          </tfoot>
      </TableFrame>

    </div>
  );
}
