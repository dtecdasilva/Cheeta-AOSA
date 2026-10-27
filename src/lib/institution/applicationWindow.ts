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
