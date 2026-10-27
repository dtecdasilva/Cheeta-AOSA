"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { InstitutionTuitionView, TuitionAccount, TuitionFigures } from "./data";

/**
 * Tuition from the database, for the tuition screens:
 *
 *   Cheeta administration  /api/admin/tuition      every account, full detail
 *   student                /api/student/tuition    their own accounts
 *   institution            /api/institution/tuition  the masked view the server works out
 *
 * Actions go to the API and the answer replaces what is on screen. Nothing
 * is decided in the browser: in particular a payment only counts once the
 * server has recorded it as verified.
 */

export type ApiTuitionAccount = TuitionAccount & {
  currency: string;
  institutionName: string;
  admissionNumber: string | null;
  figures: TuitionFigures;
  paymentMethods?: { id: string; label: string; type: string; provider: string | null; accountName: string | null; accountNumber: string | null; instructions: string | null }[];
};

export type Outcome<T = void> = { ok: true; data: T } | { ok: false; error: string; fieldErrors: Record<string, string> };

function cache<T extends { id: string }>(url: () => string) {
  let items: T[] | null = null;
  let error: string | null = null;
  let inflight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const load = () =>
    (inflight ??= fetch(url(), { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { data?: T[]; error?: string };
        if (res.ok) [items, error] = [body.data ?? [], null];
        else error = body.error ?? "Could not load tuition.";
        emit();
      })
      .catch(() => {
        error = "Could not load tuition. Check your connection.";
        emit();
      })
      .finally(() => {
        inflight = null;
      }));
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  };
  return {
    load,
    replace(item: T) {
      items = (items ?? []).some((i) => i.id === item.id) ? items!.map((i) => (i.id === item.id ? item : i)) : [...(items ?? []), item];
      emit();
    },
    all: () => items ?? [],
    use() {
      const list = useSyncExternalStore(subscribe, () => items, () => null);
      const err = useSyncExternalStore(subscribe, () => error, () => null);
      useEffect(() => {
        void load();
      }, []);
      return { items: list ?? [], loaded: list !== null || err !== null, error: err };
    },
  };
}

const accounts = cache<ApiTuitionAccount>(() => (window.location.pathname.startsWith("/admin") ? "/api/admin/tuition?pageSize=200" : "/api/student/tuition"));
const institutionViews = cache<InstitutionTuitionView & { currency: string; instalments: TuitionAccount["instalments"]; admittedAt: string | null }>(() => "/api/institution/tuition");

/** Accounts for the signed-in administrator or student. */
export const useTuitionAccounts = () => accounts.use();
/** The institution's view of its admitted students' tuition. */
export const useInstitutionTuition = () => institutionViews.use();

async function send<T>(url: string, body: unknown): Promise<Outcome<T>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = (await res.json().catch(() => ({}))) as { data?: T; error?: string; fieldErrors?: Record<string, string> };
    if (res.ok && out.data) return { ok: true, data: out.data };
    const fieldErrors = out.fieldErrors ?? {};
    return { ok: false, error: Object.values(fieldErrors)[0] ?? out.error ?? "The change could not be saved.", fieldErrors };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again.", fieldErrors: {} };
  }
}

const DECISION = { VERIFIED: "verify", QUERIED: "query", REJECTED: "reject", REOPENED: "reopen" } as const;

/** Cheeta administration's decision on a payment. Verifying is what makes a payment count. */
export async function reviewTuitionPayment(paymentId: string, action: keyof typeof DECISION, note: string, reasonId?: string) {
  const r = await send<ApiTuitionAccount>(`/api/admin/tuition/payments/${encodeURIComponent(paymentId)}/review`, { action: DECISION[action], note, ...(reasonId ? { reasonId } : {}) });
  if (r.ok) accounts.replace(r.data);
  return r;
}

/** Uploads the receipt, if there is one, then records the payment. */
export async function recordTuitionPayment(accountId: string, input: { paymentMethodId: string; reference: string; amount: number; paidOn: string; payerName: string; receipt: File | null }) {
  let receiptFileId: string | null = null;
  if (input.receipt) {
    try {
      const form = new FormData();
      form.set("file", input.receipt);
      form.set("purpose", "payment-receipt");
      const res = await fetch("/api/files", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok || !body.data) {
        const msg = body.fieldErrors?.file ?? body.error ?? "The receipt could not be uploaded.";
        return { ok: false, error: msg, fieldErrors: { receiptFileId: msg } } as Outcome<ApiTuitionAccount>;
      }
      receiptFileId = body.data.id;
    } catch {
      return { ok: false, error: "The receipt could not be uploaded. Check your connection.", fieldErrors: {} } as Outcome<ApiTuitionAccount>;
    }
  }
  const { receipt: _r, ...rest } = input;
  void _r;
  const r = await send<ApiTuitionAccount>(`/api/student/tuition/${encodeURIComponent(accountId)}/payments`, { ...rest, receiptFileId });
  if (r.ok) accounts.replace(r.data);
  return r;
}

export async function answerTuitionQuery(paymentId: string, note: string) {
  const r = await send<ApiTuitionAccount>(`/api/student/tuition/payments/${encodeURIComponent(paymentId)}/answer`, { note });
  if (r.ok) accounts.replace(r.data);
  return r;
}

export async function markTuitionReceived(paymentId: string, received: boolean) {
  const r = await send<InstitutionTuitionView & { currency: string; instalments: TuitionAccount["instalments"]; admittedAt: string | null }>(`/api/institution/tuition/payments/${encodeURIComponent(paymentId)}/received`, { received });
  if (r.ok) institutionViews.replace(r.data);
  return r;
}

/** Another loaded account with a live payment on this reference (the server refuses a second one; this flags older data). */
export function referenceInUse(reference: string, exceptPaymentId?: string) {
  const ref = reference.trim().toLowerCase();
  for (const a of accounts.all()) for (const p of a.payments) if (p.id !== exceptPaymentId && p.status !== "REJECTED" && p.reference.toLowerCase() === ref) return { a, p };
  return undefined;
}
