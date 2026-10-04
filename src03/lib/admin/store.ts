// Namespace import, not a named one: the backend imports this module for its
// seed data (src/server/db/seed.ts) and constants, and the server bundle
// rejects a named import of a client-only hook. The hooks below only ever
// run in client components.
import * as React from "react";

/**
 * A tiny client-side collection store for the Administration portal's
 * mock data.
 *
 * Why this exists: the admin screens need to *change* configuration
 * (add an institution, deactivate a BAC series) and have every other
 * screen — including the student forms — see that change. A plain
 * module-level constant can't do that, and there's no backend for these
 * domains yet. So each collection lives here, is shared through
 * `useSyncExternalStore`, and is persisted to localStorage so a refresh
 * (or a student form opened in another tab) sees the same data.
 *
 * Hydration: on the server and during hydration React uses the seed
 * (getServerSnapshot); straight after hydration it switches to whatever
 * is in localStorage. That avoids hydration mismatches without the
 * "read storage in a useEffect" dance every consumer would otherwise need.
 *
 * Replacing this with a real API later means swapping the internals of
 * `createCollection` — the hook and mutator signatures screens use stay
 * the same.
 */

const STORAGE_PREFIX = "cheeta-admin:v1:";

export interface Collection<T extends { id: string }> {
  /** React hook — the current items, re-rendering on change. */
  useItems(): T[];
  /** Non-reactive read, for event handlers. */
  getAll(): T[];
  add(item: T): void;
  update(id: string, patch: Partial<T>): void;
  remove(id: string): void;
  reset(): void;
  /**
   * React hook — the reason the server refused the last change, until
   * `clearError` or the next successful change. Always null for a
   * collection held in the browser, which has no server to refuse it.
   */
  useError(): string | null;
  clearError(): void;
  /** The records can be deleted (API-backed collections whose API allows it). */
  canRemove?: boolean;
}

const registry: Collection<{ id: string }>[] = [];

export interface CollectionOptions<T> {
  /**
   * Reconciles stored data with the current seed. Used when a release adds
   * seed records (a new parameter list, say) that a browser holding older
   * stored data would otherwise never see.
   */
  merge?: (stored: T[], seed: T[]) => T[];
}

export function createCollection<T extends { id: string }>(name: string, seed: () => T[], options: CollectionOptions<T> = {}): Collection<T> {
  const key = STORAGE_PREFIX + name;
  const seedItems = seed();
  let items: T[] | null = null;
  const listeners = new Set<() => void>();

  function load(): T[] {
    if (items) return items;
    if (typeof window === "undefined") return seedItems;
    try {
      const raw = window.localStorage.getItem(key);
      items = raw ? (JSON.parse(raw) as T[]) : seedItems;
      if (!Array.isArray(items)) items = seedItems;
      else if (raw && options.merge) items = options.merge(items, seedItems);
    } catch {
      items = seedItems;
    }
    return items;
  }

  function commit(next: T[]) {
    items = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or disabled — keep the in-memory copy for this session.
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    // Keep other tabs in step: an admin change in one tab shows up in a
    // student form open in another.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      items = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  const collection: Collection<T> = {
    useItems() {
      return React.useSyncExternalStore(subscribe, load, () => seedItems);
    },
    getAll: load,
    add(item) {
      commit([...load(), item]);
    },
    update(id, patch) {
      commit(load().map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    remove(id) {
      commit(load().filter((i) => i.id !== id));
    },
    useError() {
      return null;
    },
    clearError() {},
    reset() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      items = seedItems;
      listeners.forEach((l) => l());
    },
  };

  registry.push(collection as unknown as Collection<{ id: string }>);
  return collection;
}

export interface RemoteSpec<T> {
  /** Collection URL: GET lists (paged), POST creates. One record is at `${url}/${id}`. */
  url: string;
  /** A row from the API, as a screen record. */
  fromApi: (row: Record<string, unknown>) => T;
  /** A record (or the changed part of one) as a request body. */
  toApi: (item: Partial<T>) => Record<string, unknown>;
  /** The API accepts DELETE for this collection. */
  canRemove?: boolean;
}

/**
 * A collection whose records live in the database, behind the same
 * interface as createCollection so screens built on it don't change.
 *
 * - Until the first load finishes (and on the server) it shows the seed.
 * - A change is applied on screen at once and sent to the API. If the
 *   server refuses it, the change is undone and the reason is available
 *   through `useError`, so nothing stays on screen that wasn't saved.
 * - If the list can't be read (not signed in as someone allowed to), the
 *   seed stays in place and nothing is reported.
 */
export function createApiCollection<T extends { id: string }>(name: string, seed: () => T[], remote: RemoteSpec<T>): Collection<T> {
  const seedItems = seed();
  let items: T[] | null = null;
  let started = false;
  let error: string | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const current = () => items ?? seedItems;

  async function fetchAll() {
    try {
      const out: T[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await fetch(`${remote.url}?page=${page}&pageSize=200`, { cache: "no-store" });
        if (!res.ok) return; // Not allowed to read it, or the server is down: keep the seed.
        const body = (await res.json()) as { data: Record<string, unknown>[]; meta?: { total?: number } };
        out.push(...body.data.map(remote.fromApi));
        if (body.data.length < 200 || (body.meta?.total !== undefined && out.length >= body.meta.total)) break;
      }
      items = out;
      notify();
    } catch {
      // Offline: keep the seed.
    }
  }

  function ensureLoaded() {
    if (started || typeof window === "undefined") return;
    started = true;
    void fetchAll();
  }

  /** Sends a change; undoes it on screen and records why if the server says no. */
  async function send(method: "POST" | "PATCH" | "DELETE", url: string, body: Record<string, unknown> | null, undo: () => void, done?: (row: Record<string, unknown>) => void) {
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string> };
        const details = Object.values(data.fieldErrors ?? {}).filter(Boolean);
        error = details.length ? details.join(" ") : data.error ?? "The change could not be saved.";
        undo();
      } else {
        error = null;
        if (done && res.status !== 204) done(((await res.json()) as { data: Record<string, unknown> }).data);
      }
    } catch {
      error = "The change could not be saved. Check your connection and try again.";
      undo();
    }
    notify();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    ensureLoaded();
    return () => {
      listeners.delete(listener);
    };
  }

  const itemUrl = (id: string) => `${remote.url}/${encodeURIComponent(id)}`;
  const replace = (id: string, next: T) => {
    items = current().map((i) => (i.id === id ? next : i));
  };

  const collection: Collection<T> = {
    useItems() {
      return React.useSyncExternalStore(subscribe, current, () => seedItems);
    },
    getAll() {
      ensureLoaded();
      return current();
    },
    add(item) {
      items = [...current(), item];
      notify();
      void send(
        "POST",
        remote.url,
        remote.toApi(item),
        () => {
          items = current().filter((i) => i.id !== item.id);
        },
        (row) => replace(item.id, remote.fromApi(row))
      );
    },
    update(id, patch) {
      const before = current().find((i) => i.id === id);
      if (!before) return;
      replace(id, { ...before, ...patch });
      notify();
      void send("PATCH", itemUrl(id), remote.toApi(patch), () => replace(id, before), (row) => replace(id, remote.fromApi(row)));
    },
    remove(id) {
      const before = current();
      items = before.filter((i) => i.id !== id);
      notify();
      void send("DELETE", itemUrl(id), null, () => {
        items = before;
      });
    },
    reset() {
      started = false;
      ensureLoaded();
    },
    useError() {
      return React.useSyncExternalStore(subscribe, () => error, () => null);
    },
    clearError() {
      error = null;
      notify();
    },
    canRemove: remote.canRemove,
  };

  void name;
  registry.push(collection as unknown as Collection<{ id: string }>);
  return collection;
}

/** Restores every admin collection to its seed data. */
export function resetAllAdminData() {
  registry.forEach((c) => c.reset());
}

// ---------------------------------------------------------------------------
// Deterministic helpers for building mock data. Seeds must be identical on
// the server and the client, so nothing here may use Math.random().
// ---------------------------------------------------------------------------

export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Midnight UTC today — the anchor mock dates are generated relative to. */
export function mockAnchor(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const noopSubscribe = () => () => {};

/**
 * False during server render and hydration, true afterwards. Detail and
 * edit screens wait for this before deciding a record "doesn't exist",
 * because records an admin added live only in this browser's storage.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}
