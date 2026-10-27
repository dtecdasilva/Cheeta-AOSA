"use client";

import { useEffect, useState } from "react";
import type { DocModel, DocType } from "./data";

/**
 * Documents from the database (/api/documents). The server decides who may
 * open what; these only fetch. PDFs are opened at pdfUrl().
 */

export interface DocSubject {
  id: string;
  applicationId: string;
  status: string;
  statusLabel: string;
  studentName: string;
  registrationNo: string | null;
  institutionId: string;
  institutionName: string;
  programName: string;
}

export interface SubjectDocuments {
  id: string;
  applicationId: string;
  studentName: string;
  registrationNo: string | null;
  institutionName: string;
  status: string;
  documents: { type: DocType; label: string; description: string; available: boolean; reason?: string }[];
}

type State<T> = { data: T | null; error: string | null; loading: boolean };

function useJson<T>(url: string | null): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: !!url });
  useEffect(() => {
    if (!url) return;
    let live = true;
    setState({ data: null, error: null, loading: true });
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
        if (!live) return;
        setState(res.ok ? { data: body.data ?? null, error: null, loading: false } : { data: null, error: body.error ?? "This isn't available.", loading: false });
      })
      .catch(() => live && setState({ data: null, error: "Couldn't reach the server. Check your connection.", loading: false }));
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

export const useDocumentSubjects = (q = "") => useJson<DocSubject[]>(`/api/documents${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const useSubjectDocuments = (id: string | null) => useJson<SubjectDocuments>(id ? `/api/documents/${encodeURIComponent(id)}` : null);
export const useDocumentModel = (id: string | null, type: DocType) => useJson<DocModel>(id ? `/api/documents/${encodeURIComponent(id)}/${type}` : null);
export const pdfUrl = (id: string, type: DocType, download = false) => `/api/documents/${encodeURIComponent(id)}/${type}/pdf${download ? "?download=1" : ""}`;
