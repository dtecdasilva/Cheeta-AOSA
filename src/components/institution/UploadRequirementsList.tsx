"use client";

import Link from "next/link";
import { useState } from "react";
import { mockUploadRequirements, UploadRequirement } from "@/lib/mockData/uploadRequirements";
import { ButtonLinkClass } from "@/components/Form";
import { SectionHeading, RowList, Row, RowAction, EmptyState, Pill } from "@/components/ui";

function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb % 1024 === 0 ? 0 : 1)} MB` : `${kb} KB`;
}

export default function UploadRequirementsList({ institutionId }: { institutionId: string }) {
  const [items, setItems] = useState<UploadRequirement[]>(() =>
    mockUploadRequirements.filter((r) => r.institutionId === institutionId)
  );

  function toggleStatus(id: string) {
    setItems((s) =>
      s.map((r) => (r.id === id ? { ...r, status: r.status === "active" ? "inactive" : "active" } : r))
    );
  }

  function remove(id: string) {
    setItems((s) => s.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Upload requirements"
        actions={
          <Link href="/institution/uploads/requirements/add" className={ButtonLinkClass("primary")}>
            Add requirement
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No upload requirements configured."
          action={
            <Link href="/institution/uploads/requirements/add" className={ButtonLinkClass("secondary")}>
              Add the first requirement
            </Link>
          }
        />
      ) : (
        <RowList>
          {items.map((it) => (
            <Row
              key={it.id}
              title={it.name}
              subtitle={`${it.fileTypes.join(", ").toUpperCase()} · max ${formatSize(it.maxSizeKB)}`}
              meta={
                <div className="flex items-center gap-3">
                  {it.required ? <Pill>Required</Pill> : <Pill tone="muted">Optional</Pill>}
                  {it.status === "active" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
                </div>
              }
              actions={
                <>
                  <RowAction href={`/institution/uploads/requirements/${it.id}`}>View</RowAction>
                  <RowAction href={`/institution/uploads/requirements/${it.id}/edit`}>Edit</RowAction>
                  <RowAction tone="muted" onClick={() => toggleStatus(it.id)}>
                    {it.status === "active" ? "Deactivate" : "Activate"}
                  </RowAction>
                  <RowAction tone="danger" onClick={() => remove(it.id)}>
                    Delete
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
