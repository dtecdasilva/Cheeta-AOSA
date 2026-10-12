"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeeSummary, PayableInstitution, PaymentChannel } from "./types";
import type { PaymentMethodType } from "@/lib/institution/paymentMethods";

/**
 * How the applicant's fee screens talk to /api/student/fees and
 * /api/student/payment-methods. The server works out every figure; these
 * hooks only fetch and hold what it sent.
 */

async function readJson<T>(res: Response): Promise<T & { error?: string; fieldErrors?: Record<string, string> }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string; fieldErrors?: Record<string, string> };
}

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/**
 * The applicant's fees. `fees` is null until the first answer arrives.
 * `setCurrency` saves the currency they want amounts shown in and brings
 * back the fees converted by the server at today's rate.
 */
export function useMyFees() {
  const [fees, setFees] = useState<FeeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/student/fees", { cache: "no-store" });
      const body = await readJson<{ data?: FeeSummary }>(res);
      if (!res.ok || !body.data) return setError(body.error ?? "Your fees could not be loaded.");
      setFees(body.data);
      setError(null);
    } catch {
      setError(OFFLINE);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setCurrency = useCallback(async (currency: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/student/fees/display-currency", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency }) });
      const body = await readJson<{ data?: FeeSummary }>(res);
      if (!res.ok || !body.data) setError(body.fieldErrors?.currency ?? body.error ?? "The currency could not be changed.");
      else {
        setFees(body.data);
        setError(null);
      }
    } catch {
      setError(OFFLINE);
    }
    setSaving(false);
  }, []);

  return { fees, error, saving, setCurrency, reload };
}

export interface PaymentMethodsAnswer {
  institutions: PayableInstitution[];
  channels: PaymentChannel[];
  requireReceipt: boolean;
}

/** Where the applicant can pay: verified accounts of the institutions they applied to, optionally of one kind. Null until loaded. */
export function useMyPaymentMethods(type?: PaymentMethodType) {
  const [answer, setAnswer] = useState<PaymentMethodsAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/student/payment-methods${type ? `?type=${type}` : ""}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await readJson<{ data?: PayableInstitution[]; channels?: PaymentChannel[]; requireReceipt?: boolean }>(res);
        if (cancelled) return;
        if (!res.ok || !body.data) return setError(body.error ?? "The payment methods could not be loaded.");
        setAnswer({ institutions: body.data, channels: body.channels ?? [], requireReceipt: body.requireReceipt ?? true });
        setError(null);
      })
      .catch(() => !cancelled && setError(OFFLINE));
    return () => {
      cancelled = true;
    };
  }, [type]);

  return { ...answer, loaded: answer !== null, error };
}

export type RecordOutcome = { ok: true } | { ok: false; error: string; fieldErrors: Record<string, string> };

/**
 * Records a payment made outside the platform: uploads the receipt if
 * there is one, then sends the payment. The amount is not sent; the
 * server works it out and fixes it, with the exchange rates used, on the
 * payment.
 */
export async function recordPayment(applicationId: string, input: { paymentMethodId: string; reference: string; paidAt: string; paidFrom?: string; receipt: File | null }): Promise<RecordOutcome> {
  try {
    let receiptFileId: string | undefined;
    if (input.receipt) {
      const form = new FormData();
      form.set("file", input.receipt);
      form.set("purpose", "payment-receipt");
      const res = await fetch("/api/files", { method: "POST", body: form });
      const body = await readJson<{ data?: { id: string } }>(res);
      if (!res.ok || !body.data) return { ok: false, error: "The receipt could not be uploaded.", fieldErrors: { receiptFileId: body.fieldErrors?.file ?? body.error ?? "The receipt could not be uploaded." } };
      receiptFileId = body.data.id;
    }
    const res = await fetch(`/api/student/applications/${encodeURIComponent(applicationId)}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethodId: input.paymentMethodId, reference: input.reference, paidAt: input.paidAt, paidFrom: input.paidFrom || undefined, receiptFileId }),
    });
    if (res.ok) return { ok: true };
    const body = await readJson<object>(res);
    return { ok: false, error: body.error ?? "The payment could not be recorded.", fieldErrors: body.fieldErrors ?? {} };
  } catch {
    return { ok: false, error: OFFLINE, fieldErrors: {} };
  }
}
