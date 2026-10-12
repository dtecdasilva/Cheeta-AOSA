"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import type { Faculty } from "@/lib/institution/types";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";

/** The institution's faculties and schools, from /api/institution/faculties. */
export default function FacultyList() {
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus } = useInstitutionList<Faculty>("faculties");

  return (
    <InstitutionListShell title="Faculties" addHref="/institution/faculty/add" addLabel="Add faculty" emptyMessage="No faculties yet." canEdit={canEdit} loading={!items && !error} error={error} isEmpty={items?.length === 0}>
      {(items ?? []).map((f) => (
        <Row
          key={f.id}
          title={f.name}
          subtitle={[f.code, f.dean && `Dean: ${f.dean}`].filter(Boolean).join(" · ")}
          meta={f.status === "ACTIVE" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
          actions={
            <>
              <RowAction href={`/institution/faculty/${f.id}`}>View</RowAction>
              {canEdit && <RowAction href={`/institution/faculty/${f.id}/edit`}>Edit</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(f.id, f.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {f.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
