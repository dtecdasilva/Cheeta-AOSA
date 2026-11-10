/**
 * When an institution accepts applications. Set by the institution (or
 * Cheeta administration):
 *
 *   OPEN       accepting now; with `closesAt`, until then
 *   CLOSED     not accepting
 *   SCHEDULED  accepting from `opensAt` until `closesAt`
 *
 * While it isn't accepting, applicants can't add it or submit a new
 * application to it. Corrections it asked for can still be resubmitted.
 */

export type WindowMode = "OPEN" | "CLOSED" | "SCHEDULED";

export interface ApplicationWindow {
  mode: WindowMode;
  opensAt: string | null;
  closesAt: string | null;
  /** Shown to applicants while it's closed, e.g. "Applications for 2027 open in March." */
  message: string;
}

export interface WindowState extends ApplicationWindow {
  open: boolean;
  /** One line for applicants: "Open until 30 Nov 2026", "Opens 1 Mar 2027", "Closed". */
  label: string;
  /** Why it can't be applied to now; null while open. */
  reason: string | null;
}

/** "2026-11-30T23:59" in the browser's time, from an ISO instant, for a datetime-local input. */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** The ISO instant a datetime-local input's value stands for; null when it is empty. */
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/**
 * What is wrong with a window's dates, by field; empty when it is fine. The
 * server applies this on every save and the forms show the same messages.
 */
export function windowProblems(w: Pick<ApplicationWindow, "mode" | "opensAt" | "closesAt">, now = new Date()): Partial<Record<"opensAt" | "closesAt", string>> {
  const problems: Partial<Record<"opensAt" | "closesAt", string>> = {};
  const opens = w.opensAt ? new Date(w.opensAt).getTime() : null;
  const closes = w.closesAt ? new Date(w.closesAt).getTime() : null;
  if (w.mode === "SCHEDULED" && opens === null) problems.opensAt = "Choose when applications open.";
  if (w.mode === "SCHEDULED" && closes === null) problems.closesAt = "Choose when applications close.";
  if (opens !== null && closes !== null && closes <= opens) problems.closesAt = "Closing must come after opening.";
  if (w.mode === "OPEN" && closes !== null && closes <= now.getTime()) problems.closesAt = "The closing date has passed. Choose a later one, or close applications now.";
  return problems;
}

/** "1 Mar 2027, 08:00", in Cameroon's time, for the opening and closing moments an institution sets. */
export const formatWindowDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(new Date(iso));

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Douala" }).format(new Date(iso));

export function windowState(w: ApplicationWindow, name = "This institution", now = new Date()): WindowState {
  const t = now.getTime();
  const opens = w.opensAt ? new Date(w.opensAt).getTime() : null;
  const closes = w.closesAt ? new Date(w.closesAt).getTime() : null;
  let open: boolean;
  let label: string;
  if (w.mode === "CLOSED") {
    open = false;
    label = "Closed";
  } else if (w.mode === "OPEN") {
    open = closes === null || t < closes;
    label = open ? (w.closesAt ? `Open until ${fmt(w.closesAt)}` : "Open") : `Closed on ${fmt(w.closesAt!)}`;
  } else {
    open = opens !== null && closes !== null && t >= opens && t < closes;
    label = open ? `Open until ${fmt(w.closesAt!)}` : opens !== null && t < opens ? `Opens ${fmt(w.opensAt!)}` : w.closesAt ? `Closed on ${fmt(w.closesAt)}` : "Closed";
  }
  const reason = open ? null : `${name} isn't accepting applications at the moment (${label.toLowerCase()}).${w.message ? ` ${w.message}` : ""}`;
  return { ...w, open, label, reason };
}
