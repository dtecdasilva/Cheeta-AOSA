"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import type { Department, Faculty } from "@/lib/institution/types";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";
import { useT } from "@/lib/i18n/client";
import { useTownName } from "./LocationFields";

/** The institution's departments, each under its faculty, from /api/institution/departments. */
export default function DepartmentList() {
  const tr = useT();
  const townName = useTownName();
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus } = useInstitutionList<Department>("departments");
  const { items: faculties } = useInstitutionList<Faculty>("faculties");
  const facultyName = (id: string) => faculties?.find((f) => f.id === id)?.name;

  return (
    <InstitutionListShell title={tr("Departments")} addHref="/institution/departments/add" addLabel={tr("Add department")} emptyMessage={tr("No departments yet.")} canEdit={canEdit} loading={!items && !error} error={error} isEmpty={items?.length === 0}>
      {(items ?? []).map((d) => (
        <Row
          key={d.id}
          title={tr(d.name)}
          subtitle={[d.code, facultyName(d.facultyId), d.head && `Head: ${d.head}`, townName(d.townId)].filter(Boolean).join(" · ")}
          meta={d.status === "ACTIVE" ? <Pill tone="success">{tr("Active")}</Pill> : <Pill tone="muted">{tr("Inactive")}</Pill>}
          actions={
            <>
              <RowAction href={`/institution/departments/${d.id}`}>{tr("View")}</RowAction>
              {canEdit && <RowAction href={`/institution/departments/${d.id}/edit`}>{tr("Edit")}</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(d.id, d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {d.status === "ACTIVE" ? tr("Deactivate") : tr("Activate")}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
