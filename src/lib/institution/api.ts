"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * How the institution portal's screens talk to /api/institution/*. Every
 * one of those endpoints is confined to the signed-in institution by the
 * server, so nothing here names an institution.
 */

export type SaveOutcome<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors: Record<string, string> };

/** Creates a record (no id) or updates one, and reports what the server said. */
export async function saveRecord<T>(path: string, id: string | undefined, body: unknown): Promise<SaveOutcome<T>> {
  try {
    const res = await fetch(id ? `/api/institution/${path}/${encodeURIComponent(id)}` : `/api/institution/${path}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { data?: T; error?: string; fieldErrors?: Record<string, string> };
    if (res.ok && data.data) return { ok: true, data: data.data };
    return { ok: false, error: data.error ?? "The change could not be saved.", fieldErrors: data.fieldErrors ?? {} };
  } catch {
    return { ok: false, error: "The change could not be saved. Check your connection and try again.", fieldErrors: {} };
  }
}

/** Deletes a record. Resolves to null when it is gone, or to the reason the server refused. */
export async function deleteRecord(path: string, id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/institution/${path}/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error ?? "This record could not be deleted.";
  } catch {
    return "This record could not be deleted. Check your connection and try again.";
  }
}

/**
 * The institution's records of one kind. `items` is null until the first
 * answer arrives; `extra` is anything else the endpoint sent alongside the
 * list (the billing list's web fee, for instance).
 */
export function useInstitutionList<T, X = Record<string, unknown>>(path: string, query = "") {
  const [items, setItems] = useState<T[] | null>(null);
  const [extra, setExtra] = useState<X | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/institution/${path}?pageSize=200${query ? `&${query}` : ""}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? "Could not load this list.");
      const { data, meta: _meta, ...rest } = body as { data: T[]; meta?: unknown } & Record<string, unknown>;
      void _meta;
      setItems(data);
      setExtra(rest as X);
      setError(null);
    } catch {
      setError("Could not load this list. Check your connection.");
    }
  }, [path, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Activates or deactivates a record, then shows what the server now has. */
  const setStatus = useCallback(
    async (id: string, status: "ACTIVE" | "INACTIVE") => {
      const result = await saveRecord<T>(path, id, { status });
      if (!result.ok) setError(Object.values(result.fieldErrors)[0] ?? result.error);
      else await reload();
    },
    [path, reload]
  );

  /** Deletes a record where the API allows it; if it refuses (the record is in use), the reason is shown and the list is unchanged. */
  const remove = useCallback(
    async (id: string) => {
      const refused = await deleteRecord(path, id);
      if (refused) setError(refused);
      else await reload();
    },
    [path, reload]
  );

  return { items, extra, error, reload, setStatus, remove };
}

/** Options for a picker, from any JSON endpoint that answers `{ data: [...] }`. */
export function useOptions<T>(url: string): T[] {
  const [options, setOptions] = useState<T[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { data: T[] }).data : []))
      .then((data) => !cancelled && setOptions(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);
  return options;
}
