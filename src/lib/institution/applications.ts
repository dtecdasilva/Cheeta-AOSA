"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationStatus } from "@/lib/types";

/**
 * How the institution portal's application screens talk to
 * /api/institution/applications. Every endpoint there is confined to the
 * signed-in institution by the server, and every action is checked
 * against the staff member's permissions there too; what the screens
 * offer comes from `abilities` and `actions` in the server's answer.
 */

export type ApplicationRow =
  | { masked: true; id: string; reference: string; applicationNumber: string | null; status: ApplicationStatus; submittedAt: string | null; updatedAt: string; applicant: string }
  | {
      masked: false;
      id: string;
      reference: string;
      applicationNumber: string | null;
      status: ApplicationStatus;
      submittedAt: string | null;
      updatedAt: string;
      applicant: string;
      email: string;
      bankCode: string;
      applicationFee: number;
      programName: string | null;
      paymentVerification: PaymentCheck;
      documents: { pending: number; approved: number; rejected: number } | null;
    };

export type PaymentCheck = "PENDING" | "VERIFIED" | "NOT_RECEIVED";

export interface ApplicationFilters {
  status: string;
  q: string;
  reference: string;
  from: string;
  to: string;
}

export function useInstitutionApplications(filters: ApplicationFilters, page: number, pageSize = 25) {
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<ApplicationStatus, number>>>({});
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);
  const url = `/api/institution/applications?${query}`;

  useEffect(() => {
    const request = ++latest.current;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (request !== latest.current) return;
        if (!res.ok) return setError(body.error ?? "The applications could not be loaded.");
        setRows(body.data);
        setCounts(body.counts ?? {});
        setTotal(body.meta.total);
        setError(null);
      })
      .catch(() => request === latest.current && setError("The applications could not be loaded. Check your connection."));
  }, [url]);

  return { rows, counts, total, pages: Math.max(1, Math.ceil(total / pageSize)), error };
}

export interface HistoryItem {
  status: ApplicationStatus;
  actor: "applicant" | "institution" | "system" | "admin";
  by: string | null;
  note: string;
  reason: string | null;
  at: string;
}

export interface ReviewDocument {
  id: string;
  requirementId: string | null;
  requirementName: string;
  documentTypeId: string | null;
  required: boolean;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  uploadedAt: string;
  file: { name: string; size: number; mimeType: string; url: string } | null;
}

export interface ReviewApplication {
  id: string;
  reference: string;
  applicationNumber: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  history: HistoryItem[];
  masked: boolean;
  applicant: { displayName: string; email?: string; phone?: string | null };
  payment?: {
    bankCode: string;
    applicationFee: number;
    currency: string;
    reference: string;
    paidAt: string;
    paidFrom: string;
    account: { label: string; provider: string; accountNumber: string } | null;
    approvedAt: string | null;
    verification: { status: PaymentCheck; note: string; by: string | null; at: string | null };
  };
  choices?: { id: string; rank: number; programName: string; faculty: string; department: string; qualification: string }[];
  submitted?: boolean;
  declaration?: { acceptedAt: string; version: string } | null;
  demographic?: Record<string, string | null> | null;
  education?: { id: string; schoolName: string; schoolType: string; qualification: string; startYear: string; endYear: string; country: string }[];
  examinations?: { id: string; qualification: string; sittings: { sittingNo: number; year: string; candidateNumber: string; centreNumber: string; results: { subject: string; value: string }[] }[] }[];
  documents?: ReviewDocument[];
  missingDocuments?: string[];
  comments?: { id: string; body: string; visibleToApplicant: boolean; by: string; at: string }[];
  abilities?: { review: boolean; verifyPayment: boolean; verifyUploads: boolean; acknowledge: boolean; reject: boolean; comment: boolean };
  actions?: {
    verifyPayment: boolean;
    verifyUploads: boolean;
    acknowledge: { allowed: boolean; reason: string | null };
    reject: { allowed: boolean; reason: string | null };
    comment: boolean;
  };
}

export type ActionOutcome = { ok: true } | { ok: false; error: string; fieldErrors: Record<string, string> };

/** One application, and everything a reviewer can do to it. Each action answers with the application as it now stands. */
export function useApplicationReview(id: string) {
  const [app, setApp] = useState<ReviewApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const base = `/api/institution/applications/${encodeURIComponent(id)}`;

  const reload = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) return setMissing(true);
      if (!res.ok) return setError(body.error ?? "This application could not be loaded.");
      setApp(body.data);
      setError(null);
    } catch {
      setError("This application could not be loaded. Check your connection.");
    }
  }, [base]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const send = useCallback(
    async (path: string, method: string, body: unknown): Promise<ActionOutcome> => {
      try {
        const res = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "That couldn't be saved.", fieldErrors: data.fieldErrors ?? {} };
        if (data.data) setApp(data.data);
        else await reload();
        return { ok: true };
      } catch {
        return { ok: false, error: "That couldn't be saved. Check your connection and try again.", fieldErrors: {} };
      }
    },
    [base, reload]
  );

  return {
    app,
    error,
    missing,
    reload,
    acknowledge: (note?: string) => send("/decision", "POST", { action: "acknowledge", note: note || undefined }),
    reject: (reasonId: string, note?: string) => send("/decision", "POST", { action: "reject", reasonId, note: note || undefined }),
    verifyPayment: (decision: "verify" | "not_received", note?: string) => send("/payment-verification", "POST", { decision, note: note || undefined }),
    reviewDocument: (documentId: string, body: { decision: "approve" } | { decision: "reject"; reasonId?: string; reason?: string }) => send(`/documents/${encodeURIComponent(documentId)}`, "PATCH", body),
    comment: (body: string, visibleToApplicant: boolean) => send("/comments", "POST", { body, visibleToApplicant }),
  };
}
