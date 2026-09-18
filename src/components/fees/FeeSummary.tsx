"use client";

import { useState } from "react";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { CurrencyCode } from "@/components/currency/CurrencyCode";
import { CurrencySymbol } from "@/components/currency/CurrencySymbol";
import { FormattedCurrencyAmount } from "@/components/currency/FormattedCurrencyAmount";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import { ExchangeRateInfo } from "@/components/currency/ExchangeRateInfo";
import { institutions } from "@/lib/data";

// Fees are entered and stored in XAF throughout this platform (see
// src/lib/data.ts) — this page lets an applicant VIEW that same data in
// a currency of their choosing. It does not change what's actually owed
// or process any payment; "Do not implement real payment conversion yet"
// means this is a display feature only.
const BASE_CURRENCY = "XAF";

export function FeeSummary() {
  const [displayCurrency, setDisplayCurrency] = useState(BASE_CURRENCY);

  const total = institutions.reduce((sum, i) => sum + i.applicationFee + i.webFee, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border border-[var(--color-line)] bg-white p-5 sm:p-6">
        <div className="max-w-xs">
          <CurrencySelector label="Show fees in" value={displayCurrency} onChange={setDisplayCurrency} />
        </div>
        {displayCurrency !== BASE_CURRENCY && (
          <div className="mt-3">
            <ExchangeRateInfo fromCode={BASE_CURRENCY} toCode={displayCurrency} />
          </div>
        )}
      </div>

      <div className="border border-[var(--color-line)] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-ink-faint)]">
              <th className="px-5 py-2.5 font-normal">Institution</th>
              <th className="px-5 py-2.5 font-normal">Application fee</th>
              <th className="px-5 py-2.5 font-normal">Web/admin fee</th>
            </tr>
          </thead>
          <tbody>
            {institutions.map((inst) => (
              <tr key={inst.id} className="border-b border-[var(--color-line)] last:border-0">
                <td className="px-5 py-3 text-[var(--color-ink)]">{inst.name}</td>
                <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                  <ConvertedAmount amount={inst.applicationFee} fromCode={BASE_CURRENCY} toCode={displayCurrency} />
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                  <ConvertedAmount amount={inst.webFee} fromCode={BASE_CURRENCY} toCode={displayCurrency} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-5 py-3 font-medium text-[var(--color-ink)]">Total (all institutions)</td>
              <td colSpan={2} className="px-5 py-3">
                <ConvertedAmount
                  amount={total}
                  fromCode={BASE_CURRENCY}
                  toCode={displayCurrency}
                  className="font-[var(--font-display)] text-lg text-[var(--color-ink)]"
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border border-dashed border-[var(--color-line-strong)] p-4 text-xs text-[var(--color-ink-faint)]">
        <p className="mb-2 font-medium text-[var(--color-ink-soft)]">Currency component reference</p>
        <p>
          Symbol: <CurrencySymbol code={displayCurrency} /> · Code: <CurrencyCode code={displayCurrency} /> ·
          Formatted: <FormattedCurrencyAmount amount={12000} code={displayCurrency} />
        </p>
      </div>
    </div>
  );
}
