"use client";

import Link from "next/link";
import { mockUploadRequirements, UploadRequirement } from "@/lib/mockData/uploadRequirements";
import { PrimaryButton } from "@/components/Form";
import { useState } from "react";

export default function UploadRequirementsList({ institutionId }: { institutionId: string }) {
  const initial = mockUploadRequirements.filter((r) => r.institutionId === institutionId);
  const [items, setItems] = useState<UploadRequirement[]>(initial);

  function toggleStatus(id: string) {
    setItems((s) => s.map((r) => (r.id === id ? { ...r, status: r.status === "active" ? "inactive" : "active" } : r)));
  }

  function remove(id: string) {
    setItems((s) => s.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">Upload requirements</h2>
        <Link href="/institution/uploads/requirements/add">
          <PrimaryButton>Add requirement</PrimaryButton>
        </Link>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between rounded border border-[var(--color-line)] bg-white p-3">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{it.name} {it.required && <span className="text-xs text-[var(--color-ink-soft)]">(required)</span>}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Types: {it.fileTypes.join(", ")} • Max: {it.maxSizeKB} KB</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/institution/uploads/requirements/${it.id}`} className="text-sm text-[var(--color-ink)] underline">View</Link>
              <Link href={`/institution/uploads/requirements/${it.id}/edit`} className="text-sm text-[var(--color-ink)] underline">Edit</Link>
              <button onClick={() => toggleStatus(it.id)} className="text-sm text-[var(--color-ink-soft)]">{it.status === "active" ? "Deactivate" : "Activate"}</button>
              <button onClick={() => remove(it.id)} className="text-sm text-[var(--color-danger)]">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No upload requirements configured.</p>}
      </div>
    </div>
  );
}
