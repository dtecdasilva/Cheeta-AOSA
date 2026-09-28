"use client";

import Link from "next/link";
import { useState } from "react";
import { mockFaculties, Faculty } from "@/lib/mockData/faculties";
import { ButtonLinkClass } from "@/components/Form";
import { SectionHeading, RowList, Row, RowAction, EmptyState, Pill } from "@/components/ui";

export default function FacultyList({ institutionId }: { institutionId: string }) {
  const [items, setItems] = useState<Faculty[]>(() =>
    mockFaculties.filter((f) => f.institutionId === institutionId)
  );

  function toggleStatus(id: string) {
    setItems((s) =>
      s.map((f) => (f.id === id ? { ...f, status: f.status === "active" ? "inactive" : "active" } : f))
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Faculties"
        actions={
          <Link href="/institution/faculty/add" className={ButtonLinkClass("primary")}>
            Add faculty
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No faculties yet."
          action={
            <Link href="/institution/faculty/add" className={ButtonLinkClass("secondary")}>
              Add the first faculty
            </Link>
          }
        />
      ) : (
        <RowList>
          {items.map((f) => (
            <Row
              key={f.id}
              title={f.name}
              subtitle={`Dean: ${f.dean}`}
              meta={f.status === "active" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
              actions={
                <>
                  <RowAction href={`/institution/faculty/${f.id}`}>View</RowAction>
                  <RowAction href={`/institution/faculty/${f.id}/edit`}>Edit</RowAction>
                  <RowAction tone="muted" onClick={() => toggleStatus(f.id)}>
                    {f.status === "active" ? "Deactivate" : "Activate"}
                  </RowAction>
                </>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  );
}
