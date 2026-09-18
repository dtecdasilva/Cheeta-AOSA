"use client";

import { Faculty } from "@/lib/mockData/faculties";
import Link from "next/link";

export default function FacultyView({ faculty }: { faculty: Faculty }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">{faculty.name}</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">Dean: {faculty.dean}</p>
      </div>

      <div className="rounded border border-[var(--color-line)] bg-white p-4 space-y-2">
        <p><strong>Address:</strong> {faculty.address}</p>
        <p><strong>Location:</strong> {faculty.location}</p>
        <p><strong>Region:</strong> {faculty.region}</p>
        <p><strong>Town:</strong> {faculty.town}</p>
        <p><strong>Phone:</strong> {faculty.phone}</p>
        <p><strong>Email:</strong> {faculty.email}</p>
        <p><strong>Status:</strong> {faculty.status}</p>
      </div>

      <div>
        <Link href={`/institution/faculty/${faculty.id}/edit`} className="text-sm text-[var(--color-ink)] underline">Edit</Link>
      </div>
    </div>
  );
}
