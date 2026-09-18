"use client";

import Link from "next/link";
import { mockDepartments, Department } from "@/lib/mockData/departments";
import { PrimaryButton } from "@/components/Form";
import { useState } from "react";

export default function DepartmentList({ institutionId }: { institutionId: string }) {
  const initial = mockDepartments.filter((d) => d.institutionId === institutionId);
  const [items, setItems] = useState<Department[]>(initial);

  function toggleStatus(id: string) {
    setItems((s) => s.map((d) => (d.id === id ? { ...d, status: d.status === "active" ? "inactive" : "active" } : d)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">Departments</h2>
        <Link href="/institution/departments/add">
          <PrimaryButton>Add department</PrimaryButton>
        </Link>
      </div>

      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded border border-[var(--color-line)] bg-white p-3">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{f.name}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Head: {f.head}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/institution/departments/${f.id}`} className="text-sm text-[var(--color-ink)] underline">
                View
              </Link>
              <Link href={`/institution/departments/${f.id}/edit`} className="text-sm text-[var(--color-ink)] underline">
                Edit
              </Link>
              <button onClick={() => toggleStatus(f.id)} className="text-sm text-[var(--color-ink-soft)]">
                {f.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No departments yet.</p>}
      </div>
    </div>
  );
}
