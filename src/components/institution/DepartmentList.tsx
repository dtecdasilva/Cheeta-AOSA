"use client";

import Link from "next/link";
import { useState } from "react";
import { mockDepartments, Department } from "@/lib/mockData/departments";
import { mockFaculties } from "@/lib/mockData/faculties";
import { ButtonLinkClass } from "@/components/Form";
import { SectionHeading, RowList, Row, RowAction, EmptyState, Pill } from "@/components/ui";

export default function DepartmentList({ institutionId }: { institutionId: string }) {
  const [items, setItems] = useState<Department[]>(() =>
    mockDepartments.filter((d) => d.institutionId === institutionId)
  );

  function toggleStatus(id: string) {
    setItems((s) =>
      s.map((d) => (d.id === id ? { ...d, status: d.status === "active" ? "inactive" : "active" } : d))
    );
  }

  function facultyName(facultyId?: string) {
    return mockFaculties.find((f) => f.id === facultyId)?.name;
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Departments"
        actions={
          <Link href="/institution/departments/add" className={ButtonLinkClass("primary")}>
            Add department
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No departments yet."
          action={
            <Link href="/institution/departments/add" className={ButtonLinkClass("secondary")}>
              Add the first department
            </Link>
          }
        />
      ) : (
        <RowList>
          {items.map((d) => (
            <Row
              key={d.id}
              title={d.name}
              subtitle={[facultyName(d.facultyId), `Head: ${d.head}`].filter(Boolean).join(" · ")}
              meta={d.status === "active" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
              actions={
                <>
                  <RowAction href={`/institution/departments/${d.id}`}>View</RowAction>
                  <RowAction href={`/institution/departments/${d.id}/edit`}>Edit</RowAction>
                  <RowAction tone="muted" onClick={() => toggleStatus(d.id)}>
                    {d.status === "active" ? "Deactivate" : "Activate"}
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
