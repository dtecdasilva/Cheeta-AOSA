"use client";

import { Building2, LayoutGrid, Users, FileText, CreditCard, Upload, CheckSquare, XCircle, FilePlus, List, Layers } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PublicUser } from "@/lib/auth/users";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { mockInstitutionPortalCounts } from "@/lib/mockData/institutionPortal";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/institution", icon: LayoutGrid },
  { label: "Faculty/School", href: "/institution/faculty", icon: Layers },
  { label: "Departments", href: "/institution/departments", icon: List },
  { label: "Anticipated Qualifications", href: "/institution/qualifications", icon: FilePlus },
  { label: "Study Programs", href: "/institution/programs", icon: FileText },
  { label: "Billing", href: "/institution/billing", icon: CreditCard },
  { label: "Upload Requirements", href: "/institution/uploads/requirements", icon: Upload },
  { label: "Payment Methods", href: "/institution/payment-methods", icon: CreditCard },
  { label: "Manage Users", href: "/institution/users", icon: Users },
  { label: "Student Applications", href: "/institution/applications", icon: FileText },
  { label: "Student Payments & Uploads", href: "/institution/payments", icon: CreditCard },
  { label: "Acknowledged Applications", href: "/institution/applications/acknowledged", icon: CheckSquare },
  { label: "Rejected Applications", href: "/institution/applications/rejected", icon: XCircle },
  { label: "Deliberation List", href: "/institution/deliberation", icon: List },
];

export function InstitutionShell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const counts = mockInstitutionPortalCounts[user.institutionId ?? "inst-1"] ?? { applications: 0, pending: 0, paymentVerification: 0, uploadVerification: 0, acknowledged: 0, rejected: 0, deliberation: 0, accepted: 0 };

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <div className="lg:flex">
        <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:flex-col bg-[var(--color-ink)] text-white/90">
          <div className="flex items-center gap-2.5 px-6 py-6">
            <Building2 className="h-6 w-6 text-[var(--color-brass)]" strokeWidth={1.75} />
            <div>
              <p className="font-[var(--font-display)] text-[15px] leading-tight text-white">Cheeta AOSA</p>
              <p className="text-[11px] leading-tight text-white/50">Institution portal</p>
            </div>
          </div>
          <nav className="mt-2 flex-1 space-y-0.5 px-3 py-4">
            {NAV_ITEMS.map((it) => {
              const Icon = it.icon as any;
              return (
                <Link key={it.href} href={it.href} className="flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-white/5">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  <span>{it.label}</span>
                  {it.label === "Acknowledged Applications" && (
                    <span className="ml-auto inline-flex items-center gap-2 rounded bg-[var(--color-info-soft)] px-2 py-0.5 text-xs text-[var(--color-info)]">{counts.acknowledged}</span>
                  )}
                  {it.label === "Rejected Applications" && (
                    <span className="ml-auto inline-flex items-center gap-2 rounded bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs text-[var(--color-danger)]">{counts.rejected}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 px-3 py-4">
            <LogoutButton />
          </div>
        </aside>

        <div className="lg:hidden border-b border-[var(--color-line)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-[var(--color-brass)]" />
              <div>
                <p className="font-[var(--font-display)] text-sm text-[var(--color-ink)]">Cheeta AOSA</p>
                <p className="text-xs text-[var(--color-ink-soft)]">Institution portal</p>
              </div>
            </div>
            <button onClick={() => setMobileOpen((s) => !s)} className="text-[var(--color-ink)]">
              Menu
            </button>
          </div>
          {mobileOpen && (
            <nav className="space-y-1 border-t border-[var(--color-line)] px-3 py-3">
              {NAV_ITEMS.map((it) => {
                const Icon = it.icon as any;
                return (
                  <Link key={it.href} href={it.href} className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--color-ink)]">
                    <Icon className="h-4 w-4" />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-5">
            <div>
              <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">{user.institutionName ?? "Institution"}</h1>
              <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{ROLE_LABELS[user.role]}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[var(--color-ink)]">{user.fullName}</p>
              <p className="text-xs text-[var(--color-ink-faint)]">{user.email}</p>
            </div>
          </header>
          <main className="px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
