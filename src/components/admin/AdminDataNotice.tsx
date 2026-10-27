"use client";

import { applicationStore, studentStore } from "@/lib/admin/students";
import { institutionStore } from "@/lib/admin/institutions";
import { useT } from "@/lib/i18n/client";

/**
 * Says so when the student, application or institution lists behind a
 * screen couldn't be loaded, or were too long to load in full, so the
 * figures on it are never taken for the whole picture by mistake.
 */
export function AdminDataNotice() {
  const tr = useT();
  const errors = [studentStore.useError(), applicationStore.useError(), institutionStore.useError()].filter(Boolean) as string[];
  if (!errors.length) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm">
      {[...new Set(errors)].map((e) => (
        <p key={e}>{tr(e)}</p>
      ))}
    </div>
  );
}
