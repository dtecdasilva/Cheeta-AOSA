"use client";

import { Department } from "@/lib/mockData/departments";
import Link from "next/link";

export default function DepartmentView({ department }: { department: Department }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">{department.name}</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">Head: {department.head}</p>
      </div>

      <div className="rounded border border-[var(--color-line)] bg-white p-4 space-y-2">
        <p><strong>Address:</strong> {department.address}</p>
        <p><strong>Location:</strong> {department.location}</p>
        <p><strong>Region:</strong> {department.region}</p>
        <p><strong>Town:</strong> {department.town}</p>
        <p><strong>Phone:</strong> {department.phone}</p>
        <p><strong>Email:</strong> {department.email}</p>
        <p><strong>Status:</strong> {department.status}</p>
      </div>

      <div>
        <Link href={`/institution/departments/${department.id}/edit`} className="text-sm text-[var(--color-ink)] underline">Edit</Link>
      </div>
    </div>
  );
}
