"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import type { Faculty } from "@/lib/institution/types";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";
import { useT } from "@/lib/i18n/client";
import { useTownName } from "./LocationFields";

/** The institution's faculties and schools, from /api/institution/faculties. */
export default function FacultyList() {
  const tr = useT();
  const townName = useTownName();
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus } = useInstitutionList<Faculty>("faculties");

  return (
    <InstitutionListShell title={tr("Faculties")} addHref="/institution/faculty/add" addLabel={tr("Add faculty")} emptyMessage={tr("No faculties yet.")} canEdit={canEdit} loading={!items && !error} error={error} isEmpty={items?.length === 0}>
      {(items ?? []).map((f) => (
        <Row
          key={f.id}
          title={tr(f.name)}
          subtitle={[f.code, f.dean && `Dean: ${f.dean}`, townName(f.townId)].filter(Boolean).join(" · ")}
          meta={f.status === "ACTIVE" ? <Pill tone="success">{tr("Active")}</Pill> : <Pill tone="muted">{tr("Inactive")}</Pill>}
          actions={
            <>
              <RowAction href={`/institution/faculty/${f.id}`}>{tr("View")}</RowAction>
              {canEdit && <RowAction href={`/institution/faculty/${f.id}/edit`}>{tr("Edit")}</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(f.id, f.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {f.status === "ACTIVE" ? tr("Deactivate") : tr("Activate")}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
