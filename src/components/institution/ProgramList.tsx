"use client";

import Link from "next/link";
import { mockPrograms } from "@/lib/mockData/programs";
import { PrimaryButton } from "@/components/Form";

export default function ProgramList({ institutionId }: { institutionId: string }) {
  const items = mockPrograms.filter((p) => p.institutionId === institutionId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">Study programs</h2>
        <Link href="/institution/programs/add">
          <PrimaryButton>Add program</PrimaryButton>
        </Link>
      </div>

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded border border-[var(--color-line)] bg-white p-3">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{p.name} <span className="text-xs text-[var(--color-ink-soft)]">({p.code})</span></p>
              <p className="text-xs text-[var(--color-ink-soft)]">Spaces: {p.availableSpaces}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/institution/programs/${p.id}`} className="text-sm text-[var(--color-ink)] underline">View</Link>
              <Link href={`/institution/programs/${p.id}/edit`} className="text-sm text-[var(--color-ink)] underline">Edit</Link>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No programs yet.</p>}
      </div>
    </div>
  );
}
