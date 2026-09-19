"use client";

import { PAGE_MAIN_CLASS } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { Topbar } from "@/components/Topbar";
import { formatDateTime } from "@/lib/utils";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const { notifications, markNotificationRead } = useApp();

  return (
    <>
      <Topbar title="Notifications" description="Updates on your applications and account." />
      <main className={PAGE_MAIN_CLASS}>
        {notifications.length === 0 ? (
          <div className="border border-dashed border-[var(--color-line-strong)] px-6 py-14 text-center text-sm text-[var(--color-ink-soft)]">
            You have no notifications yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] bg-[var(--color-surface)]">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--color-paper)]"
              >
                <Bell
                  className={`mt-0.5 h-4 w-4 shrink-0 ${n.read ? "text-[var(--color-ink-faint)]" : "text-[var(--color-brass)]"}`}
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm ${n.read ? "text-[var(--color-ink-soft)]" : "font-medium text-[var(--color-ink)]"}`}>
                      {n.title}
                    </p>
                    <span className="shrink-0 text-xs text-[var(--color-ink-faint)]">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{n.body}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
