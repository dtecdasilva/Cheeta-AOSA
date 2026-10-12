"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentRequirement } from "@/lib/institutionDiscovery/data";
import type { ApplicationStatus } from "@/lib/types";

/**
 * How the applicant's institution screens (Institution Summary, Add
 * Institution, Institution Upload) talk to /api/student/applications.
 *
 * An "application" here is the applicant's application to ONE
 * institution: its program choices, uploaded documents, payments and
 * status are its own. Every change is sent to the server and the screen
 * then shows what the server answered, so nothing is on screen that
 * wasn't saved.
 */

export interface ChoiceView {
  id: string;
  rank: number;
  programId: string;
  programName: string;
  programCode: string;
  facultyId: string;
  faculty: string;
  departmentId: string;
  department: string;
  qualification: string;
}

export interface DocumentView {
  id: string;
  requirementId: string | null;
  requirementName: string;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  /** A link to open the file; it expires after a few minutes, so reload the list to get a fresh one. */
  file: { id: string; name: string; size: number; url: string } | null;
  uploadedAt: string;
}

export interface ReadinessCheck {
  key: "personal" | "education" | "examinations" | "results" | "institution" | "programs" | "documents" | "fee" | "payment";
  label: string;
  ok: boolean;
  detail: string;
}

export interface HistoryEntry {
  status: ApplicationStatus;
  actor: "applicant" | "institution" | "system" | "admin";
  note: string;
  at: string;
}

export interface MyApplication {
  /** The application to this institution (application_institutions.id). */
  id: string;
  /** The working reference, given when the institution was added. */
  reference: string;
  /** The Application ID, issued on first submission; null before. */
  applicationNumber: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  declarationAcceptedAt: string | null;
  institution: { id: string; name: string };
  /** Program choices and removal are open until the application is submitted. */
  canEdit: boolean;
  /** Documents can also be replaced after the institution sends an application back. */
  canUploadDocuments: boolean;
  maxProgramChoices: number;
  choices: ChoiceView[];
  requirements: DocumentRequirement[];
  documents: DocumentView[];
  payments: { id: string; approval: "AWAITING" | "APPROVED" | "REJECTED"; amount: number; currency: string; bankCode: string | null; paidAt: string; rejectionReason: string | null; reference: string }[];
  /** Every status the application has been through, oldest first. */
  history: HistoryEntry[];
  /** The institution's own check that the fee reached its account, once it has made it. */
  institutionPaymentCheck: { result: "VERIFIED" | "NOT_RECEIVED"; note: string; at: string } | null;
  /** Comments the institution shared with the applicant. */
  comments: { id: string; body: string; at: string }[];
  readiness: { ready: boolean; checks: ReadinessCheck[] };
  /** Whether it can be sent now, as a first submission or a resubmission; if not, why not. */
  submission: { mode: "submit" | "resubmit" | null; reason: string | null; declarationVersion: string };
}

export type Outcome = { ok: true } | { ok: false; error: string };

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

async function send(url: string, init: RequestInit): Promise<{ ok: true; data: MyApplication | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, init);
    const body = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as { data?: MyApplication; error?: string; fieldErrors?: Record<string, string> };
    if (res.ok) return { ok: true, data: body.data ?? null };
    // A problem with one field is the useful message; the general one is "Some fields need attention".
    const field = Object.values(body.fieldErrors ?? {}).find(Boolean);
    return { ok: false, error: field ?? body.error ?? "The change could not be saved." };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/**
 * The institutions the applicant has applied to, each in full, and the
 * things they can do to them. `applications` is null until the first
 * answer arrives. Each action resolves to whether the server accepted
 * it, with its reason if not.
 */
export function useMyApplications() {
  const [applications, setApplications] = useState<MyApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/student/applications?view=full", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { data?: MyApplication[]; error?: string };
      if (!res.ok || !body.data) return setError(body.error ?? "Your institutions could not be loaded.");
      setApplications(body.data);
      setError(null);
    } catch {
      setError(OFFLINE);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Puts the server's version of one application in the list (adding it if it is new). */
  const keep = useCallback((next: MyApplication) => {
    setApplications((prev) => {
      const list = prev ?? [];
      return list.some((a) => a.id === next.id) ? list.map((a) => (a.id === next.id ? next : a)) : [...list, next];
    });
  }, []);

  const act = useCallback(
    async (url: string, init: RequestInit): Promise<Outcome> => {
      const result = await send(url, init);
      if (!result.ok) return result;
      if (result.data) keep(result.data);
      return { ok: true };
    },
    [keep]
  );

  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const at = (id: string) => `/api/student/applications/${encodeURIComponent(id)}`;

  return {
    applications,
    error,
    reload,
    /** Applies to an institution. Its fee is worked out by the server as it is added. */
    add: (institutionId: string) => act("/api/student/applications", json("POST", { institutionId })),
    /** Withdraws an application that hasn't been submitted or paid for. */
    remove: async (id: string): Promise<Outcome> => {
      const result = await send(at(id), { method: "DELETE" });
      if (!result.ok) return result;
      setApplications((prev) => (prev ?? []).filter((a) => a.id !== id));
      return { ok: true };
    },
    /** Replaces the ranked program choices: the first is rank 1, with no gaps. */
    setChoices: (id: string, programIds: string[]) => act(`${at(id)}/choices`, json("PUT", { choices: programIds.map((programId, i) => ({ programId, rank: i + 1 })) })),
    /** Uploads a document against one of the institution's requirements, replacing an earlier upload for it. */
    upload: (id: string, requirementId: string, file: File) => {
      const form = new FormData();
      form.set("requirementId", requirementId);
      form.set("file", file);
      return act(`${at(id)}/documents`, { method: "POST", body: form });
    },
    removeDocument: (id: string, documentId: string) => act(`${at(id)}/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" }),
    /** Submits (or resubmits) one application, confirming the declaration in the wording given. */
    submit: (id: string, declarationVersion: string) => act(`${at(id)}/submit`, json("POST", { declaration: true, declarationVersion })),
    /** Takes up or declines an institution's offer. */
    respondToOffer: (id: string, decision: "accept" | "decline") => act(`${at(id)}/offer`, json("POST", { decision })),
  };
}

export type MyApplications = ReturnType<typeof useMyApplications>;
