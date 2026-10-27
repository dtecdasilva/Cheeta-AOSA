"use client";

import { useCallback, useEffect, useState } from "react";
import type { Condition, Criterion, Outcome, RuleScope } from "@/lib/admission/rules";

/**
 * The institution's admission rules, from /api/institution/admission-rules.
 * The server keeps every version of a rule and confines everything to the
 * signed-in institution; only its administrator can change rules.
 */

export interface RuleVersion {
  id: string;
  version: number;
  condition: Condition;
  scope: RuleScope;
  summary: string;
  appliesTo: string[];
  notes: string;
  createdBy: string | null;
  createdAt: string;
  usedByDeliberation: boolean;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  current: RuleVersion | null;
  versionCount: number;
  versions?: RuleVersion[];
}

export interface RuleOptions {
  criteria: Criterion[];
  faculties: { id: string; name: string }[];
  departments: { id: string; name: string; facultyId: string }[];
  programs: { id: string; name: string; facultyId: string; departmentId: string }[];
}

export interface Evaluation {
  rule: { id: string; name: string; version: number };
  application: { id: string; reference: string };
  choices: { rank: number; programId: string; programName: string; applies: boolean; pass: boolean | null; outcome: Outcome | null }[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors: Record<string, string> };

const BASE = "/api/institution/admission-rules";

async function call<T>(method: string, url: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, { method, cache: "no-store", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const b = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: b.data };
    return { ok: false, error: b.error ?? "That couldn't be saved.", fieldErrors: b.fieldErrors ?? {} };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection.", fieldErrors: {} };
  }
}

function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let live = true;
    call<T>("GET", url).then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, setData };
}

export const useRules = () => useLoad<Rule[]>(BASE);
export const useRule = (id: string) => useLoad<Rule>(id ? `${BASE}/${encodeURIComponent(id)}` : null);
export const useRuleOptions = () => useLoad<RuleOptions>(`${BASE}/options`);

export const createRule = (body: { name: string; description: string; condition: Condition; scope: RuleScope; notes: string }) => call<Rule>("POST", BASE, body);
export const updateRule = (id: string, body: { name?: string; description?: string; status?: "ACTIVE" | "INACTIVE" }) => call<Rule>("PATCH", `${BASE}/${encodeURIComponent(id)}`, body);
export const addRuleVersion = (id: string, body: { condition: Condition; scope: RuleScope; notes: string }) => call<Rule>("POST", `${BASE}/${encodeURIComponent(id)}/versions`, body);
export const deleteRule = (id: string) => call<void>("DELETE", `${BASE}/${encodeURIComponent(id)}`);
export const evaluateRule = (id: string, applicationId: string, version?: number) => call<Evaluation>("POST", `${BASE}/${encodeURIComponent(id)}/evaluate`, { applicationId, version });
