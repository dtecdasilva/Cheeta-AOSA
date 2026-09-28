"use client";

import { ShieldCheck, LayoutGrid, Menu, X, Building2, Layers, List, FileText, UserPlus, Users, ClipboardList, CreditCard, Settings, Globe, DollarSign, GitBranch, SlidersHorizontal, GraduationCap, MapPin, BadgeCheck, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { PublicUser } from "@/lib/auth/users";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useUnreadCount } from "@/components/notifications/NotificationCentre";

type NavItem = { label: string; href: string; icon: typeof LayoutGrid };

const NAV_SECTIONS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutGrid }] },
  {
    title: "Institutions",
    items: [
      { label: "Institutions", href: "/admin/institutions", icon: Building2 },
      { label: "Faculty / School", href: "/admin/faculty", icon: Layers },
      { label: "Departments", href: "/admin/departments", icon: List },
      { label: "Qualifications / Programs", href: "/admin/programs", icon: FileText },
    ],
  },
  {
    title: "Students",
    items: [
      { label: "Student registration", href: "/admin/students/register", icon: UserPlus },
      { label: "Student summary", href: "/admin/students/summary", icon: Users },
      { label: "Student applications", href: "/admin/applications", icon: ClipboardList },
      { label: "Application summary", href: "/admin/applications/summary", icon: FileText },
      { label: "Application progression", href: "/admin/applications/progression", icon: GitBranch },
    ],
  },
  {
    title: "Parameters",
    items: [
      { label: "Institution parameters", href: "/admin/parameters/institution", icon: SlidersHorizontal },
      { label: "Location parameters", href: "/admin/parameters/location", icon: MapPin },
      { label: "Application parameters", href: "/admin/parameters/application", icon: ClipboardList },
      { label: "Examination parameters", href: "/admin/parameters/examination", icon: GraduationCap },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Institution payment methods", href: "/admin/payment-methods", icon: CreditCard },
      { label: "Payment configuration", href: "/admin/payment-config", icon: CreditCard },
      { label: "Tuition verification", href: "/admin/tuition", icon: BadgeCheck },
    ],
  },
  {
    title: "Notifications",
    items: [
      { label: "Notification centre", href: "/admin/notifications", icon: Bell },
      { label: "Notification templates", href: "/admin/notifications/templates", icon: FileText },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Access management", href: "/admin/access", icon: Users },
      { label: "System config", href: "/admin/config", icon: Settings },
      { label: "Countries", href: "/admin/config/countries", icon: Globe },
      { label: "Currencies", href: "/admin/config/currencies", icon: DollarSign },
      { label: "Exchange rates", href: "/admin/config/exchange-rates", icon: DollarSign },
    ],
  },
];

const ALL_HREFS = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));

/** The most specific nav entry matching the path, so /admin/applications/summary doesn't also light up /admin/applications. */
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => pathname === href || pathname.startsWith(href + "/")).sort((a, b) => b.length - a.length)[0];
}

export function AdminShell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const current = activeHref(pathname);
  const unread = useUnreadCount("admin");

  return (
    <div className="flex min-h-screen bg-[var(--color-paper)]">
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col bg-[var(--color-ink)] text-white/90 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-0 lg:w-64 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2.5 px-6 py-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 shrink-0 text-[var(--color-brass)]" strokeWidth={1.75} />
            <div>
              <p className="font-[var(--font-display)] text-[15px] leading-tight text-white">Cheeta AOSA</p>
              <p className="text-[11px] leading-tight text-white/50">Administration portal</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-white/60 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title ?? "main"} className={section.title ? "pt-4" : undefined}>
              {section.title && (
                <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{section.title}</p>
              )}
              {section.items.map((item) => {
                const active = item.href === current;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                      active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {active && <span className="absolute left-0 top-0 h-full w-0.5 bg-[var(--color-brass)]" />}
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/admin/notifications" && unread > 0 && (
                      <span className="bg-[var(--color-brass)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)]">{unread}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-[var(--color-ink)]">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <ShieldCheck className="h-5 w-5 text-[var(--color-brass)]" strokeWidth={1.75} />
          <span className="font-[var(--font-display)] text-sm text-[var(--color-ink)]">Cheeta AOSA</span>
        </div>

        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <p className="font-[var(--font-display)] text-xl text-[var(--color-ink)] sm:text-2xl">AOSA Administration</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{ROLE_LABELS[user.role]}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-[var(--color-ink)]">{user.fullName}</p>
            <p className="text-xs text-[var(--color-ink-faint)]">{user.email}</p>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
