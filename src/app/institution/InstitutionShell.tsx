"use client";

import { Building2, LayoutGrid } from "lucide-react";
import type { PublicUser } from "@/lib/auth/users";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function InstitutionShell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--color-paper)]">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-[var(--color-ink)] text-white/90">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <Building2 className="h-6 w-6 text-[var(--color-brass)]" strokeWidth={1.75} />
          <div>
            <p className="font-[var(--font-display)] text-[15px] leading-tight text-white">Cheeta AOSA</p>
            <p className="text-[11px] leading-tight text-white/50">Institution portal</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          <span className="flex items-center gap-3 border-l-2 border-[var(--color-brass)] bg-white/10 px-3 py-2.5 text-sm text-white">
            <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
            Dashboard
          </span>
        </nav>
        <div className="border-t border-white/10 px-3 py-4">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-5">
          <div>
            <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">
              {user.institutionName ?? "Institution"}
            </h1>
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
  );
}
