"use client";

import { PAGE_MAIN_CLASS } from "@/components/ui";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Topbar } from "@/components/Topbar";
import { StatusBadge } from "@/components/StatusBadge";
import { institutions } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default function ApplicationsPage() {
  const { applications } = useApp();

  return (
    <>
      <Topbar title="My applications" description="Every institution you've applied to, and where each one stands." />
      <main className={PAGE_MAIN_CLASS}>
        <div className="flex justify-end">
          <Link
            href="/student/applications/new"
            className="inline-flex items-center gap-2 bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brass-dark)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New application
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="mt-6 border border-dashed border-[var(--color-line-strong)] px-6 py-14 text-center text-sm text-[var(--color-ink-soft)]">
            You haven&apos;t started an application yet.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {applications.map((app) => (
              <div key={app.id} className="border border-[var(--color-line)] bg-[var(--color-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
                  <div>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      Application started {formatDate(app.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={app.overallStatus} />
                    <Link
                      href={`/applications/${app.id}`}
                      className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4"
                    >
                      Open
                    </Link>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--color-ink-faint)]">
                      <th className="px-5 py-2 font-normal">Institution</th>
                      <th className="px-5 py-2 font-normal">Type</th>
                      <th className="px-5 py-2 font-normal">Location</th>
                      <th className="px-5 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.institutionIds.map((id) => {
                      const inst = institutions.find((i) => i.id === id);
                      if (!inst) return null;
                      return (
                        <tr key={id} className="border-t border-[var(--color-line)]">
                          <td className="px-5 py-2.5 text-[var(--color-ink)]">{inst.name}</td>
                          <td className="px-5 py-2.5 text-[var(--color-ink-soft)]">{inst.type}</td>
                          <td className="px-5 py-2.5 text-[var(--color-ink-soft)]">{inst.location}</td>
                          <td className="px-5 py-2.5">
                            <StatusBadge status={app.perInstitutionStatus[id]} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
