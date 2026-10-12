"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENCIES, type CurrencyInfo } from "./data";
import { getCurrencies } from "./getCurrencies";
import { formatMoney } from "./money";

/** The stored currency list; the starting list until it has loaded. */
export function useCurrencies(): CurrencyInfo[] {
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>(CURRENCIES);
  useEffect(() => {
    let cancelled = false;
    getCurrencies().then((list) => !cancelled && setCurrencies(list));
    return () => {
      cancelled = true;
    };
  }, []);
  return currencies;
}

/**
 * A function that writes an amount the way its currency is written
 * ("12,000 FCFA", "$19.65"), using the stored symbol, position and
 * decimal places. It only formats: the amount it is given is shown as it
 * is, never converted.
 */
export function useMoneyFormat(): (amount: number, code: string) => string {
  const currencies = useCurrencies();
  return useCallback((amount: number, code: string) => formatMoney(amount, code, currencies.find((c) => c.code === code)), [currencies]);
}
