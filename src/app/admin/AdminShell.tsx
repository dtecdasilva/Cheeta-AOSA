"use client";

import { LayoutGrid, Menu, X, Building2, Layers, List, FileText, UserPlus, Users, ClipboardList, CreditCard, Settings, Globe, DollarSign, GitBranch, SlidersHorizontal, GraduationCap, MapPin, BadgeCheck, Bell, Receipt, Stethoscope, Award, Printer, BarChart3, History } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { PublicUser } from "@/lib/auth/users";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/brand/Logo";
import { useUnreadCount } from "@/components/notifications/NotificationCentre";
import { useT } from "@/lib/i18n/client";

type NavItem = { label: string; href: string; icon: typeof LayoutGrid };

const NAV_SECTIONS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutGrid }] },
  {
    title: "Institutions",
    items: [
      { label: "Institutions", href: "/admin/institutions", icon: Building2 },
      { label: "Faculty / School", href: "/admin/faculty", icon: Layers },
      { label: "Department", href: "/admin/departments", icon: List },
      { label: "Qualifications / Study Programs", href: "/admin/programs", icon: FileText },
    ],
  },
  {
    title: "Students",
    items: [
      { label: "Student Registration", href: "/admin/students/register", icon: UserPlus },
      { label: "Student Summary", href: "/admin/students/summary", icon: Users },
      { label: "Student Application", href: "/admin/applications", icon: ClipboardList },
      { label: "Student Application Summary", href: "/admin/applications/summary", icon: FileText },
      { label: "Application Progression", href: "/admin/applications/progression", icon: GitBranch },
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
      { label: "Institution Payment Methods", href: "/admin/payment-methods", icon: CreditCard },
      { label: "Payment Configuration", href: "/admin/payment-config", icon: CreditCard },
      { label: "Application fee payments", href: "/admin/payments", icon: Receipt },
      { label: "Tuition verification", href: "/admin/tuition", icon: BadgeCheck },
    ],
  },
  {
    title: "Enrolment",
    items: [
      { label: "Medical verification", href: "/admin/medical", icon: Stethoscope },
      { label: "Matriculation", href: "/admin/matriculation", icon: Award },
      { label: "Documents", href: "/admin/documents", icon: Printer },
    ],
  },
  { title: "Reports", items: [{ label: "Reports", href: "/admin/reports", icon: BarChart3 }] },
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
      { label: "Access Management", href: "/admin/access", icon: Users },
      { label: "Audit log", href: "/admin/audit", icon: History },
      { label: "System Configurations", href: "/admin/config", icon: Settings },
      { label: "Countries", href: "/admin/config/countries", icon: Globe },
      { label: "Currencies", href: "/admin/config/currencies", icon: DollarSign },
      { label: "Exchange Rates", href: "/admin/config/exchange-rates", icon: DollarSign },
    ],
  },
];

const ALL_HREFS = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));

/** The most specific nav entry matching the path, so /admin/applications/summary doesn't also light up /admin/applications. */
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => pathname === href || pathname.startsWith(href + "/")).sort((a, b) => b.length - a.length)[0];
}

export function AdminShell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  const tr = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const current = activeHref(pathname);
  const unread = useUnreadCount("admin");

  return (
    <div className="flex min-h-screen bg-[var(--color-paper)]">
      {mobileOpen && (
        <button
          aria-label={tr("Close menu")}
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 rounded-none bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-0 lg:w-64 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-[var(--shadow-popover)] lg:shadow-none" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2.5 px-5 py-5">
          <Logo sublabel={tr("Administration portal")} priority />
          <button onClick={() => setMobileOpen(false)} className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] lg:hidden" aria-label={tr("Close menu")}>
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title ?? "main"} className={section.title ? "pt-4" : undefined}>
              {section.title && (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">{tr(section.title)}</p>
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
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-ink)]" : "text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
                    }`}
                  >
                    {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--color-brand)]" />}
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--color-brand)]" : "text-[var(--color-ink-faint)]"}`} strokeWidth={1.75} />
                    <span className="flex-1">{tr(item.label)}</span>
                    {item.href === "/admin/notifications" && unread > 0 && (
                      <span className="min-w-5 rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">{tr(unread)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--color-line)] px-3 py-3">
          <LanguageSwitch className="mb-2" />
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label={tr("Open menu")} className="text-[var(--color-ink)]">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <Logo height={24} />
        </div>

        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <p className="text-xl font-bold tracking-tight text-[var(--color-ink)] sm:text-2xl">{tr("AOSA Administration")}</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{tr(ROLE_LABELS[user.role])}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-[var(--color-ink)]">{tr(user.fullName)}</p>
            <p className="text-xs text-[var(--color-ink-faint)]">{user.email}</p>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
