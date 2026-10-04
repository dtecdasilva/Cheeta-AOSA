"use client";

import { useAuth } from "@/context/AuthContext";

export function Topbar({ title, description }: { title: string; description?: string }) {
  const { user } = useAuth();
  const initials = user?.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-5">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-[var(--color-ink)]">{user?.fullName ?? "…"}</p>
          <p className="text-xs text-[var(--color-ink-faint)]">{user?.email}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center border border-[var(--color-line-strong)] bg-[var(--color-brass-soft)] text-sm font-semibold text-[var(--color-brass-dark)]">
          {initials || "?"}
        </div>
      </div>
    </header>
  );
}
