"use client";

import {
  LayoutGrid,
  FileText,
  CreditCard,
  Upload,
  List,
  Layers,
  Wallet,
  X,
  Menu,
  type LucideIcon,
  BadgeCheck,
  Bell,
  Receipt,
  Stethoscope,
  Award,
  Printer,
  BarChart3,
  ListChecks,
  History,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicUser } from "@/lib/auth/users";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/brand/Logo";
import { useUnreadCount } from "@/components/notifications/NotificationCentre";
import { useT } from "@/lib/i18n/client";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which derived count, if any, to show as a badge. */
  badge?: "applications" | "notifications";
  /** Only the institution's administrator sees it. */
  adminOnly?: boolean;
}

/** Only routes that actually exist are listed here. */
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/institution/dashboard", icon: LayoutGrid },
  { label: "Faculty / School", href: "/institution/faculty", icon: Layers },
  { label: "Departments", href: "/institution/departments", icon: List },
  { label: "Anticipated Qualifications", href: "/institution/qualifications", icon: GraduationCap },
  { label: "Study Programs", href: "/institution/programs", icon: FileText },
  { label: "Billing", href: "/institution/billing", icon: Wallet },
  { label: "Payment Methods", href: "/institution/payment-methods", icon: CreditCard },
  { label: "Manage Users", href: "/institution/staff", icon: List },
  { label: "Upload Requirements", href: "/institution/uploads/requirements", icon: Upload },
  { label: "Student Applications", href: "/institution/applications", icon: FileText, badge: "applications" },
  { label: "Acknowledged Applications", href: "/institution/applications/acknowledged", icon: BadgeCheck },
  { label: "Rejected Applications", href: "/institution/applications/rejected", icon: X },
  { label: "Deliberation", href: "/institution/deliberations", icon: ListChecks },
  { label: "Admissions", href: "/institution/admissions", icon: FileText },
  { label: "Application Fees", href: "/institution/payments", icon: Receipt },
  { label: "Tuition Verification", href: "/institution/tuition", icon: BadgeCheck },
  { label: "Medical Verification", href: "/institution/medical", icon: Stethoscope },
  { label: "Matriculation", href: "/institution/matriculation", icon: Award },
  { label: "Documents", href: "/institution/documents", icon: Printer },
  { label: "Reports", href: "/institution/reports", icon: BarChart3 },
  { label: "Audit log", href: "/institution/audit", icon: History, adminOnly: true },
  { label: "Notifications", href: "/institution/notifications", icon: Bell, badge: "notifications" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function InstitutionShell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  const tr = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  // Applications waiting for the institution's review (GET /api/institution/dashboard), for the sidebar badge.
  const [toReview, setToReview] = useState(0);
  useEffect(() => {
    fetch("/api/institution/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && setToReview(b.data.awaitingReview ?? 0))
      .catch(() => undefined);
  }, [pathname]);
  const unreadNotifications = useUnreadCount("institution");

  // The most specific entry wins: on /institution/applications/rejected only "Rejected Applications" is highlighted.
  const activeHref = NAV_ITEMS.map((i) => i.href).filter((h) => isActive(pathname, h)).sort((a, b) => b.length - a.length)[0];
  const nav = (
    <>
      {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "INSTITUTION_ADMIN").map((item) => {
        const active = item.href === activeHref;
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
            {item.badge === "applications" && toReview > 0 && (
              <span className="ml-auto min-w-5 rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                {toReview}
              </span>
            )}
            {item.badge === "notifications" && unreadNotifications > 0 && (
              <span className="ml-auto min-w-5 rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                {tr(unreadNotifications)}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

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
          <Logo sublabel={tr("Institution portal")} priority />
          <button onClick={() => setMobileOpen(false)} className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] lg:hidden" aria-label={tr("Close menu")}>
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">{tr(nav)}</nav>

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
            <p className="text-xl font-bold tracking-tight text-[var(--color-ink)] sm:text-2xl">
              {user.institutionName ?? tr("Institution")}
            </p>
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
