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
