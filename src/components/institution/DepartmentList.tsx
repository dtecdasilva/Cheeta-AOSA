"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import type { Department, Faculty } from "@/lib/institution/types";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";

/** The institution's departments, each under its faculty, from /api/institution/departments. */
export default function DepartmentList() {
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus } = useInstitutionList<Department>("departments");
  const { items: faculties } = useInstitutionList<Faculty>("faculties");
  const facultyName = (id: string) => faculties?.find((f) => f.id === id)?.name;

  return (
    <InstitutionListShell title="Departments" addHref="/institution/departments/add" addLabel="Add department" emptyMessage="No departments yet." canEdit={canEdit} loading={!items && !error} error={error} isEmpty={items?.length === 0}>
      {(items ?? []).map((d) => (
        <Row
          key={d.id}
          title={d.name}
          subtitle={[d.code, facultyName(d.facultyId), d.head && `Head: ${d.head}`].filter(Boolean).join(" · ")}
          meta={d.status === "ACTIVE" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
          actions={
            <>
              <RowAction href={`/institution/departments/${d.id}`}>View</RowAction>
              {canEdit && <RowAction href={`/institution/departments/${d.id}/edit`}>Edit</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(d.id, d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {d.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
