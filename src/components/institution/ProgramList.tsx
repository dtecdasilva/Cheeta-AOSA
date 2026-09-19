"use client";

import Link from "next/link";
import { mockPrograms } from "@/lib/mockData/programs";
import { mockDepartments } from "@/lib/mockData/departments";
import { ButtonLinkClass } from "@/components/Form";
import { SectionHeading, RowList, Row, RowAction, EmptyState, Pill } from "@/components/ui";

export default function ProgramList({ institutionId }: { institutionId: string }) {
  const items = mockPrograms.filter((p) => p.institutionId === institutionId);

  function departmentName(departmentId?: string) {
    return mockDepartments.find((d) => d.id === departmentId)?.name;
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Study programs"
        actions={
          <Link href="/institution/programs/add" className={ButtonLinkClass("primary")}>
            Add program
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No study programs yet."
          action={
            <Link href="/institution/programs/add" className={ButtonLinkClass("secondary")}>
              Add the first program
            </Link>
          }
        />
      ) : (
        <RowList>
          {items.map((p) => (
            <Row
              key={p.id}
              title={`${p.name} (${p.code})`}
              subtitle={[departmentName(p.departmentId), `${p.availableSpaces ?? 0} spaces`]
                .filter(Boolean)
                .join(" · ")}
              meta={p.status === "active" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
              actions={
                <>
                  <RowAction href={`/institution/programs/${p.id}`}>View</RowAction>
                  <RowAction href={`/institution/programs/${p.id}/edit`}>Edit</RowAction>
                </>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  );
}
