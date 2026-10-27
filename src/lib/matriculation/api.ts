"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { MedicalClearance } from "@/lib/medical/data";
import type { AdmissionState, MatricStatus, TuitionClearance } from "./data";

/**
 * Matriculation from the database. Cheeta administration reads
 * /api/admin/matriculation, institution staff /api/institution/matriculation
 * (their own students, masked where tuition says so), students
 * /api/student/matriculation. Confirming and cancelling are decided by the
 * server, which checks who is asking and that every condition is met.
 */

export interface MatricRow {
  account: {
    id: string;
    studentId: string;
    studentName: string;
    registrationNo: string;
    applicationRef: string;
    institutionId: string;
    institutionName: string;
    programId: string;
    programName: string;
    admittedAt: string;
    offerAccepted: boolean;
    tuitionAmount: number;
    firstInstalment: number;
    verified: number;
    currency: string;
  };
  admission: AdmissionState;
  tuition: TuitionClearance;
  medical: MedicalClearance;
  medicalRecords: { id: string; requirementCode: string; requirementLabel: string; required: boolean; status: "NOT_STARTED" | "SCHEDULED" | "AWAITING" | "VERIFIED" | "RETEST"; result: "FIT" | "CONDITIONAL" | "UNFIT" | null; verificationDate: string | null }[];
  status: MatricStatus;
  record: { id: string; code: string; matriculatedAt: string; confirmedBy: string; note: string } | null;
  cancelled: { code: string; matriculatedAt: string; cancelledAt: string | null; cancelReason: string | null }[];
  blockers: string[];
  maskedForInstitution: boolean;
}

const url = () => {
  const path = window.location.pathname;
  return path.startsWith("/admin") ? "/api/admin/matriculation" : path.startsWith("/institution") ? "/api/institution/matriculation" : "/api/student/matriculation";
};

let rows: MatricRow[] | null = null;
let error: string | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  inflight ??= fetch(url(), { cache: "no-store" })
    .then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as { data?: MatricRow[]; error?: string };
      if (res.ok) [rows, error] = [body.data ?? [], null];
      else error = body.error ?? "Could not load matriculation.";
      emit();
    })
    .catch(() => {
      error = "Could not load matriculation. Check your connection.";
      emit();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useMatricRows() {
  const list = useSyncExternalStore(subscribe, () => rows, () => null);
  const err = useSyncExternalStore(subscribe, () => error, () => null);
  useEffect(() => {
    void load();
  }, []);
  return { rows: list ?? [], loaded: list !== null || err !== null, error: err };
}

async function post(path: string, body: unknown): Promise<{ ok: true; row: MatricRow } | { ok: false; error: string; fieldErrors: Record<string, string> }> {
  try {
    const res = await fetch(`${url()}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = (await res.json().catch(() => ({}))) as { data?: MatricRow; error?: string; fieldErrors?: Record<string, string> };
    if (!res.ok || !out.data) return { ok: false, error: out.error ?? "The change could not be saved.", fieldErrors: out.fieldErrors ?? {} };
    rows = (rows ?? []).map((r) => (r.account.id === out.data!.account.id ? out.data! : r));
    emit();
    return { ok: true, row: out.data };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again.", fieldErrors: {} };
  }
}

/** Confirms matriculation; the server issues the code, or says what is still missing. */
export const confirmMatriculation = (accountId: string, note: string) => post(encodeURIComponent(accountId), { note });
/** Cancels a matriculation confirmed in error, with the reason. */
export const cancelMatriculation = (accountId: string, reason: string) => post(`${encodeURIComponent(accountId)}/cancel`, { reason });
