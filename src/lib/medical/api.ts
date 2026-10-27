"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { MedicalClearance, MedicalRecord, MedicalUpdate } from "./data";

/**
 * Medical verification from the database: Cheeta administration reads
 * /api/admin/medical, institution staff /api/institution/medical (their own
 * students only). Changes are made by the server, which checks who may
 * make them; what it answers replaces what is on screen.
 */

export type ApiMedicalRecord = MedicalRecord & { requirementLabel: string; required: boolean; verifiedBy: string | null; verifiedAt: string | null; locked: boolean; institutionName: string; certificateUrl: string | null };

const base = () => (window.location.pathname.startsWith("/admin") ? "/api/admin/medical" : "/api/institution/medical");

let records: ApiMedicalRecord[] | null = null;
let clearance: Record<string, MedicalClearance> = {};
let error: string | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  inflight ??= fetch(base(), { cache: "no-store" })
    .then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as { data?: ApiMedicalRecord[]; clearance?: Record<string, MedicalClearance>; error?: string };
      if (res.ok) [records, clearance, error] = [body.data ?? [], body.clearance ?? {}, null];
      else error = body.error ?? "Could not load medical verification.";
      emit();
    })
    .catch(() => {
      error = "Could not load medical verification. Check your connection.";
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

export function useMedicalRecords() {
  const list = useSyncExternalStore(subscribe, () => records, () => null);
  const err = useSyncExternalStore(subscribe, () => error, () => null);
  const clear = useSyncExternalStore(subscribe, () => clearance, () => clearance);
  useEffect(() => {
    void load();
  }, []);
  return { records: list ?? [], clearance: clear, loaded: list !== null || err !== null, error: err };
}

/** Saves a change to one record. Returns the server's field errors, or null when saved. */
export async function updateMedicalRecord(id: string, patch: MedicalUpdate): Promise<{ error: string; fieldErrors: Record<string, string> } | null> {
  try {
    const res = await fetch(`${base()}/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string> };
    if (!res.ok) return { error: body.error ?? "The change could not be saved.", fieldErrors: body.fieldErrors ?? {} };
    await load(); // The student's clearance may have changed too.
    return null;
  } catch {
    return { error: "Couldn't reach the server. Check your connection and try again.", fieldErrors: {} };
  }
}
