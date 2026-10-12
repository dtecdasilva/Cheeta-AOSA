"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Payment records as the two portals that look at them read them from the
 * API: Cheeta administration, which verifies each one
 * (/api/admin/fee-payments), and an institution, which is told only who
 * has paid (/api/institution/fee-payments).
 *
 * A payment is AWAITING from the moment the applicant records it until an
 * administrator approves or rejects it. Nothing else changes that.
 */

export type Verification = "AWAITING" | "APPROVED" | "REJECTED";

export const VERIFICATION_META: Record<Verification, { label: string; tone: "info" | "success" | "danger" }> = {
  AWAITING: { label: "Awaiting verification", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** An exchange rate and the amounts either side of it, as stored when the payment was recorded. */
export interface StoredConversion {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fromAmount: number;
  toAmount: number;
}

/** The institution account a payment was made into, as it read on the day it was recorded. */
export interface PaidIntoAccount {
  type: string;
  label: string;
  provider: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  swift: string;
}

export interface PaymentRecord {
  id: string;
  applicationInstitutionId: string;
  applicationReference: string;
  institutionId: string;
  institutionName: string;
  applicantName: string;
  applicantEmail: string;
  programName: string | null;
  method: string;
  methodLabel: string;
  paymentAccount: PaidIntoAccount | null;
  paidFrom: string;
  reference: string;
  /** How many other applications carry a payment with this same reference. */
  sameReferenceElsewhere: number;
  currency: string;
  amount: number;
  applicationFee: number;
  webFee: number;
  feeConversion: StoredConversion | null;
  displayConversion: StoredConversion | null;
  paidAt: string;
  submittedAt: string;
  evidence: { id: string; name: string; size: number; mimeType: string; url: string } | null;
  approval: Verification;
  verifiedBy: { id: string; name: string } | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  note: string;
  bankCode: string | null;
  canReopen: boolean;
}

interface Totals {
  count: number;
  amount: number;
  applicationFee: number;
  webFee: number;
}

export interface PaymentSummary {
  currency: string;
  awaiting: Totals;
  approved: Totals;
  rejected: Totals;
  institutions: { id: string; name: string }[];
  methods: { id: string; label: string }[];
}

export interface PaymentFilters {
  approval: string;
  institutionId: string;
  method: string;
  from: string;
  to: string;
  q: string;
}

export type Decision = { decision: "approve"; note?: string } | { decision: "reject"; reasonId?: string; reason?: string } | { decision: "reopen" };

export type DecisionOutcome = { ok: true; record: { approval: Verification; bankCode: string | null } } | { ok: false; error: string; fieldErrors: Record<string, string> };

const PAGE_SIZE = 20;

/** The verification desk's list: one page of records for the filters, the totals, and the way to decide one. */
export function usePaymentRecords(filters: PaymentFilters, page: number) {
  const [records, setRecords] = useState<PaymentRecord[] | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Answers can arrive out of order while someone types in the search box; only the latest request's is shown.
  const latest = useRef(0);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const url = `/api/admin/fee-payments?${query}`;

  const reload = useCallback(async () => {
    const request = ++latest.current;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (request !== latest.current) return;
      if (!res.ok) return setError(body.error ?? "The payment records could not be loaded.");
      setRecords(body.data);
      setSummary(body.summary);
      setTotal(body.meta.total);
      setError(null);
    } catch {
      if (request === latest.current) setError("The payment records could not be loaded. Check your connection.");
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const decide = useCallback(
    async (id: string, decision: Decision): Promise<DecisionOutcome> => {
      try {
        const res = await fetch(`/api/admin/fee-payments/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(decision) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: body.error ?? "The decision could not be saved.", fieldErrors: body.fieldErrors ?? {} };
        await reload();
        return { ok: true, record: body.data };
      } catch {
        return { ok: false, error: "The decision could not be saved. Check your connection and try again.", fieldErrors: {} };
      }
    },
    [reload]
  );

  return { records, summary, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), error, reload, decide };
}

// ---------------------------------------------------------------------------
// The institution's view
// ---------------------------------------------------------------------------

/** An application's fee as its institution may see it: paid under a bank code, or one masked line. */
export type InstitutionFee =
  | { state: "AWAITING"; id: string; displayName: string }
  | { state: "PAID"; id: string; applicationReference: string; displayName: string; programName: string | null; bankCode: string; /** The institution's own fee. The web fee is never included. */ applicationFee: number; currency: string; approvedAt: string };

export interface InstitutionFeeSummary {
  awaiting: number;
  paid: number;
  applicationFees: number;
  currency: string;
}

export function useInstitutionFees(filters: { state: string; q: string }, page: number, pageSize = 25) {
  const [fees, setFees] = useState<InstitutionFee[] | null>(null);
  const [summary, setSummary] = useState<InstitutionFeeSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.state) query.set("state", filters.state);
  if (filters.q) query.set("q", filters.q);
  const url = `/api/institution/fee-payments?${query}`;

  useEffect(() => {
    const request = ++latest.current;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (request !== latest.current) return;
        if (!res.ok) return setError(body.error ?? "The application fees could not be loaded.");
        setFees(body.data);
        setSummary(body.summary);
        setTotal(body.meta.total);
        setError(null);
      })
      .catch(() => request === latest.current && setError("The application fees could not be loaded. Check your connection."));
  }, [url]);

  return { fees, summary, total, pages: Math.max(1, Math.ceil(total / pageSize)), error };
}

/** Looks a bank code up at the signed-in institution. Null when no approved payment there has it. */
export async function findByBankCode(code: string): Promise<{ ok: true; fee: Extract<InstitutionFee, { state: "PAID" }> | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/institution/fee-payments/lookup?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? "The lookup failed. Try again." };
    return { ok: true, fee: body.data };
  } catch {
    return { ok: false, error: "The lookup failed. Check your connection and try again." };
  }
}
