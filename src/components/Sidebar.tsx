"use client";
import Image from "next/image";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { STUDENT_NAV, STUDENT_NAV_UTILITY } from "@/lib/studentNav";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { notifications } = useApp();
  const unread = notifications.filter((n) => !n.read).length;

  // Groups containing the active route start expanded; the rest collapsed.
  const initialExpanded = useMemo(() => {
    const state: Record<string, boolean> = {};
    STUDENT_NAV.forEach((entry) => {
      if (entry.kind === "group") {
        state[entry.label] = entry.children.some((c) => isActive(pathname, c.href));
      }
    });
    return state;
  }, [pathname]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(initialExpanded);

  function toggle(label: string) {
    setExpanded((e) => ({ ...e, [label]: !e[label] }));
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col bg-[var(--color-ink)] text-white/90 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-0 lg:w-64 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between gap-2.5 px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Cheeta AOSA logo" width={24} height={24} className="h-6 w-6 object-contain" />
          <div>
            <p className="font-[var(--font-display)] text-[15px] leading-tight text-white">Cheeta AOSA</p>
            <p className="text-[11px] leading-tight text-white/50">Applicant portal</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white lg:hidden" aria-label="Close menu">
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
                className={`relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && <span className="absolute left-0 top-0 h-full w-0.5 bg-[var(--color-brass)]" />}
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {entry.label}
              </Link>
            );
          }

          const Icon = entry.icon;
          const isOpen = !!expanded[entry.label];
          const groupHasActive = entry.children.some((c) => isActive(pathname, c.href));
          return (
            <div key={entry.label}>
              <button
                onClick={() => toggle(entry.label)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                  groupHasActive ? "text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
                aria-expanded={isOpen}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="flex-1">{entry.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  strokeWidth={2}
                />
              </button>
              {isOpen && (
                <div className="ml-4 space-y-0.5 border-l border-white/10 pl-4">
                  {entry.children.map((child) => {
                    const active = isActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className={`block px-2 py-2 text-[13px] leading-tight transition-colors ${
                          active ? "text-[var(--color-brass)]" : "text-white/55 hover:text-white"
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

        <div className="mt-3 border-t border-white/10 pt-3">
          {STUDENT_NAV_UTILITY.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && <span className="absolute left-0 top-0 h-full w-0.5 bg-[var(--color-brass)]" />}
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {item.label}
                {item.href === "/student/notifications" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-[var(--color-brass)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)]">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
