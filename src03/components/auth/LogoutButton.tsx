"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function LogoutButton({ className = "" }: { className?: string }) {
  const { logout } = useAuth();
  return (
    <button
      onClick={() => logout()}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper)] ${className}`}
    >
      <LogOut className="h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
      Sign out
    </button>
  );
}
