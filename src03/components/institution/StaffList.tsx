"use client";

import { useMemo } from "react";
import Link from "next/link";
import { findStaffForInstitution } from "@/lib/mockData/staff";
import { Card, RowList, Row, EmptyState } from "@/components/ui";

export default function StaffList({ institutionId }: { institutionId: string }) {
  const staff = useMemo(() => findStaffForInstitution(institutionId), [institutionId]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold tracking-tight text-lg">Staff</h2>
          <Link href="/institution/staff/add" className="text-sm underline">
            Add staff
          </Link>
        </div>
      </Card>

      {staff.length === 0 ? (
        <EmptyState message="No staff members found." action={<Link href="/institution/staff/add">Add staff</Link>} />
      ) : (
        <RowList>
          {staff.map((s) => (
            <Row
              key={s.id}
              title={`${s.name} (${s.staffId})`}
              subtitle={`${s.position} • ${s.title ?? ""}`}
              meta={<div className="text-xs text-[var(--color-ink-soft)]">{s.role}</div>}
              actions={<Link href={`/institution/staff/${s.id}`}>View</Link>}
            />
          ))}
        </RowList>
      )}
    </div>
  );
}
