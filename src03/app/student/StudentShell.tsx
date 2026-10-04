"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/brand/Logo";
import type { PublicUser } from "@/lib/auth/users";

export function StudentShell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  // `user` is validated server-side by requireRole() before this ever
  // renders; it's accepted here only so the shell can be extended later
  // (e.g. a role-specific banner) without threading auth through again.
  void user;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--color-paper)]">
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 rounded-none bg-black/40 lg:hidden"
        />
      )}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-[var(--color-ink)]">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <Logo height={24} />
        </div>
        {children}
      </div>
    </div>
  );
}
