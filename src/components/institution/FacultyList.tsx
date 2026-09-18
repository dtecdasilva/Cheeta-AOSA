"use client";

import Link from "next/link";
import { mockFaculties, Faculty } from "@/lib/mockData/faculties";
import { PrimaryButton, SecondaryButton } from "@/components/Form";
import { useState } from "react";

export default function FacultyList({ institutionId }: { institutionId: string }) {
  const initial = mockFaculties.filter((f) => f.institutionId === institutionId);
  const [items, setItems] = useState<Faculty[]>(initial);

  function toggleStatus(id: string) {
    setItems((s) => s.map((f) => (f.id === id ? { ...f, status: f.status === "active" ? "inactive" : "active" } : f)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">Faculties</h2>
        <Link href="/institution/faculty/add">
          <PrimaryButton>Add faculty</PrimaryButton>
        </Link>
      </div>

      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded border border-[var(--color-line)] bg-white p-3">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{f.name}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Dean: {f.dean}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/institution/faculty/${f.id}`} className="text-sm text-[var(--color-ink)] underline">
                View
              </Link>
              <Link href={`/institution/faculty/${f.id}/edit`} className="text-sm text-[var(--color-ink)] underline">
                Edit
              </Link>
              <button onClick={() => toggleStatus(f.id)} className="text-sm text-[var(--color-ink-soft)]">
                {f.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No faculties yet.</p>}
      </div>
    </div>
  );
}
