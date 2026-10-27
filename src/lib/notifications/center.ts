import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * Notification centre data for all three portals, from /api/notifications:
 * what the platform raised for the signed-in person, how each was
 * delivered (in-app, email, SMS) and its history.
 */

export type NotificationCategory =
  | "REGISTRATION"
  | "APPLICATION"
  | "PAYMENT"
  | "UPLOAD"
  | "VERIFICATION"
  | "REJECTION"
  | "RESUBMISSION"
  | "ADMISSION";

export type Audience = "student" | "institution" | "admin";
export type Channel = "IN_APP" | "EMAIL" | "SMS";
export type DeliveryStatus = "DELIVERED" | "SENT" | "QUEUED" | "FAILED" | "SKIPPED";

export const CATEGORY_META: Record<NotificationCategory, { label: string; description: string; tone: "neutral" | "info" | "amber" | "success" | "danger" }> = {
  REGISTRATION: { label: "Registration", description: "Account creation and sign-in details", tone: "neutral" },
  APPLICATION: { label: "Application", description: "Starting, completing and submitting applications", tone: "info" },
  PAYMENT: { label: "Payment", description: "Fees and tuition payments", tone: "info" },
  UPLOAD: { label: "Upload", description: "Documents received", tone: "neutral" },
  VERIFICATION: { label: "Verification", description: "Applications, documents and payments checked", tone: "success" },
  REJECTION: { label: "Rejection", description: "Something was not accepted", tone: "danger" },
  RESUBMISSION: { label: "Resubmission", description: "Corrections requested or received", tone: "amber" },
  ADMISSION: { label: "Admission", description: "Offers and next steps after admission", tone: "success" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as NotificationCategory[];

export const CHANNEL_LABELS: Record<Channel, string> = { IN_APP: "In-app", EMAIL: "Email", SMS: "SMS" };

export interface Delivery {
  channel: Channel;
  to: string;
  status: DeliveryStatus;
  at: string;
  detail?: string;
}

export type HistoryKind = "CREATED" | "DELIVERED" | "FAILED" | "READ" | "UNREAD" | "ARCHIVED" | "RESTORED";

export interface HistoryEvent {
  kind: HistoryKind;
  at: string;
  channel?: Channel;
  note?: string;
}

export interface CentreNotification {
  id: string;
  audience: Audience;
  category: NotificationCategory;
  title: string;
  /** One line for the list. */
  summary: string;
  /** Full message; blank lines separate paragraphs. */
  body: string;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
  important: boolean;
  action?: { label: string; href: string };
  reference?: string;
  institutionName?: string;
  templateCode?: string;
  deliveries: Delivery[];
  history: HistoryEvent[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const EMPTY: CentreNotification[] = [];
let cache: CentreNotification[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** The signed-in person's notifications, archived ones included, from /api/notifications. */
function load(): Promise<void> {
  loading ??= fetch("/api/notifications?archived=true&pageSize=200", { cache: "no-store" })
    .then(async (res) => {
      if (res.ok) {
        cache = ((await res.json()) as { data: CentreNotification[] }).data;
        emit();
      }
    })
    .catch(() => undefined)
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Shows a change at once and sends it; whatever the server then says is what stays. */
function change(ids: string[], patch: (n: CentreNotification, now: string) => Partial<CentreNotification>, send: () => Promise<Response>) {
  if (!cache) return;
  const now = new Date().toISOString();
  cache = cache.map((n) => (ids.includes(n.id) ? { ...n, ...patch(n, now) } : n));
  emit();
  void send()
    .catch(() => undefined)
    .finally(() => void load());
}

const patchOne = (id: string, body: { read?: boolean; archived?: boolean }) => () =>
  fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * The notification centre for the signed-in person, whatever the portal:
 * the server decides what they see (their own notices and their
 * audience's). Checked again every minute while a centre is open.
 */
export function useNotifications(audience: Audience) {
  void audience;
  const all = useSyncExternalStore(subscribe, () => cache ?? EMPTY, () => EMPTY);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, []);

  const mine = useMemo(() => [...all].sort(byNewest), [all]);
  const inbox = useMemo(() => mine.filter((n) => !n.archivedAt), [mine]);
  const unreadCount = inbox.filter((n) => !n.readAt).length;

  const markRead = useCallback((id: string) => change([id], (_n, now) => ({ readAt: now }), patchOne(id, { read: true })), []);
  const markUnread = useCallback((id: string) => change([id], () => ({ readAt: null }), patchOne(id, { read: false })), []);
  const archive = useCallback((id: string) => change([id], (n, now) => ({ archivedAt: now, readAt: n.readAt ?? now }), patchOne(id, { archived: true })), []);
  const restore = useCallback((id: string) => change([id], () => ({ archivedAt: null }), patchOne(id, { archived: false })), []);
  const markAllRead = useCallback((ids: string[]) => change(ids, (n, now) => ({ readAt: n.readAt ?? now }), () => fetch("/api/notifications/read-all", { method: "POST" })), []);

  return { all: mine, inbox, unreadCount, loaded: all !== EMPTY || cache !== null, markRead, markUnread, archive, restore, markAllRead };
}

function byNewest(a: CentreNotification, b: CentreNotification) {
  return b.createdAt.localeCompare(a.createdAt);
}

export const HISTORY_LABELS: Record<HistoryKind, string> = {
  CREATED: "Created",
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
  READ: "Read",
  UNREAD: "Marked unread",
  ARCHIVED: "Archived",
  RESTORED: "Restored to inbox",
};
