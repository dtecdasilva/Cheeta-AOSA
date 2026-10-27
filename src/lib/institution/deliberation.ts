"use client";

import { useCallback, useEffect, useState } from "react";
import type { Outcome } from "@/lib/admission/rules";

/**
 * Deliberation runs, from /api/institution/deliberation/runs. A run proposes;
 * publishing the latest run makes the offers. Everything is confined to the
 * signed-in institution, needs the "Deliberation List" permission and an
 * active deliberation subscription.
 */

export interface RunReport {
  listed: number;
  passedGeneral: number;
  failedGeneral: number;
  admitted: { total: number; firstChoice: number; secondChoice: number; thirdChoice: number };
  unsuccessful: number;
  rankBy: { key: string; label: string } | null;
  rules: { ruleId: string; rule: string; version: number; kind: "GENERAL" | "PROGRAM" }[];
  programs: { programId: string; program: string; faculty: string; department: string; places: number; admitted: number; byChoice: number[]; applied: number; metRequirements: number }[];
}

export interface RunSummary {
  id: string;
  runNumber: number;
  status: "COMPLETED" | "PUBLISHED";
  notes: string;
  summary: RunReport;
  createdAt: string;
  publishedAt: string | null;
  latest: boolean;
}

interface Check {
  label: string;
  pass: boolean;
  detail: string;
}
interface RuleOutcome {
  ruleId: string;
  rule: string;
  version: number;
  pass: boolean;
  outcome: Outcome;
}
export interface RunResult {
  applicationId: string;
  applicationNumber: string;
  applicant: string;
  currentStatus: string;
  outcome: "ACCEPTED" | "UNSUCCESSFUL";
  choice: number | null;
  programId: string | null;
  program: string | null;
  failedAt: "GENERAL" | "CHOICES" | null;
  merit: number | null;
  note: string;
  reasons: {
    general?: { pass: boolean; checks: Check[]; rules: RuleOutcome[] };
    choices?: { rank: number; program: string; requirementsMet: boolean; checks: Check[]; rules: RuleOutcome[]; placed: boolean | null; position: number | null; competing: number | null }[];
  } | null;
}

export interface RunDetail {
  id: string;
  runNumber: number;
  status: "COMPLETED" | "PUBLISHED";
  notes: string;
  rankBy: string | null;
  runBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  latest: boolean;
  canPublish: boolean;
  report: RunReport;
  results: RunResult[];
  published?: { offered: number; skipped: string[] };
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const BASE = "/api/institution/deliberation/runs";

async function call<T>(method: string, url: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, { method, cache: "no-store", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const b = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: b.data } : { ok: false, error: b.error ?? "That couldn't be done." };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection." };
  }
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    call<T>("GET", url).then((r) => live && (r.ok ? (setData(r.data), setError(null)) : setError(r.error)));
    return () => {
      live = false;
    };
  }, [url, tick]);
  return { data, error, setData, reload: useCallback(() => setTick((t) => t + 1), []) };
}

export const useRuns = () => useLoad<RunSummary[]>(BASE);
export const useRun = (id: string) => useLoad<RunDetail>(`${BASE}/${encodeURIComponent(id)}`);
export const runDeliberation = (body: { rankBy?: string; notes?: string }) => call<RunDetail>("POST", BASE, body);
export const publishRun = (id: string) => call<RunDetail>("POST", `${BASE}/${encodeURIComponent(id)}/publish`);
export const reportUrl = (id: string) => `${BASE}/${encodeURIComponent(id)}/report`;
