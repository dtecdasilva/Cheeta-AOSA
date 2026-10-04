"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { useUnreadCount } from "@/components/notifications/NotificationCentre";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Logo } from "@/components/brand/Logo";
import { STUDENT_NAV, STUDENT_NAV_UTILITY, type NavEntry } from "@/lib/studentNav";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const unread = useUnreadCount("student");

  /**
   * A group is open if the user explicitly toggled it, otherwise if it
   * contains the current route.
   *
   * The previous version computed the "contains active route" map with
   * useMemo and passed it to useState — but useState only ever reads its
   * argument on the first render, so navigating to a page inside a
   * collapsed group left that group shut, with no visible indication of
   * where you were. Tracking only the explicit overrides and deriving the
   * rest on each render means the open state follows the route.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  function isGroupOpen(entry: Extract<NavEntry, { kind: "group" }>) {
    const override = overrides[entry.label];
    if (override !== undefined) return override;
    return entry.children.some((c) => isActive(pathname, c.href));
  }

  function toggle(entry: Extract<NavEntry, { kind: "group" }>) {
    setOverrides((e) => ({ ...e, [entry.label]: !isGroupOpen(entry) }));
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-0 lg:w-64 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0 shadow-[var(--shadow-popover)] lg:shadow-none" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between gap-2.5 px-5 py-5">
        <Logo sublabel="Applicant portal" priority />
        <button onClick={onClose} className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {STUDENT_NAV.map((entry) => {
          if (entry.kind === "link") {
            const active = isActive(pathname, entry.href);
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={onClose}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-ink)]" : "text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--color-brand)]" />}
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--color-brand)]" : "text-[var(--color-ink-faint)]"}`} strokeWidth={1.75} />
                {entry.label}
              </Link>
            );
          }

          const Icon = entry.icon;
          const isOpen = isGroupOpen(entry);
          const groupHasActive = entry.children.some((c) => isActive(pathname, c.href));
          return (
            <div key={entry.label}>
              <button
                onClick={() => toggle(entry)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper)] ${
                  groupHasActive ? "font-medium" : ""
                }`}
                aria-expanded={isOpen}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${groupHasActive ? "text-[var(--color-brand)]" : "text-[var(--color-ink-faint)]"}`}
                  strokeWidth={1.75}
                />
                <span className="flex-1">{entry.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-[var(--color-ink-faint)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  strokeWidth={2}
                />
              </button>
              {isOpen && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-[var(--color-line)] pl-3">
                  {entry.children.map((child) => {
                    const active = isActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-md px-2.5 py-1.5 text-[13px] leading-tight transition-colors ${
                          active
                            ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-ink)]"
                            : "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-3 space-y-0.5 border-t border-[var(--color-line)] pt-3">
          {STUDENT_NAV_UTILITY.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-ink)]" : "text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--color-brand)]" />}
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--color-brand)]" : "text-[var(--color-ink-faint)]"}`} strokeWidth={1.75} />
                {item.label}
                {item.href === "/student/notifications" && unread > 0 && (
                  <span className="ml-auto min-w-5 rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[var(--color-line)] px-3 py-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
