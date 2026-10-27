"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList, useOptions } from "@/lib/institution/api";
import type { Department, Program } from "@/lib/institution/types";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";
import { useT } from "@/lib/i18n/client";

/** The institution's study programs, from /api/institution/programs. */
export default function ProgramList() {
  const tr = useT();
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus } = useInstitutionList<Program>("programs");
  const { items: departments } = useInstitutionList<Department>("departments");
  const qualifications = useOptions<{ id: string; label: string }>("/api/reference/parameters?category=qualification-types");
  const departmentName = (id: string) => departments?.find((d) => d.id === id)?.name;
  const qualificationName = (id: string) => qualifications.find((q) => q.id === id)?.label;

  return (
    <InstitutionListShell title={tr("Study programs")} addHref="/institution/programs/add" addLabel={tr("Add program")} emptyMessage={tr("No study programs yet.")} canEdit={canEdit} loading={!items && !error} error={error} isEmpty={items?.length === 0}>
      {(items ?? []).map((p) => (
        <Row
          key={p.id}
          title={tr(p.name)}
          subtitle={[p.code, qualificationName(p.qualificationId), departmentName(p.departmentId), `${p.availableSpaces} space${p.availableSpaces === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
          meta={p.status === "ACTIVE" ? <Pill tone="success">{tr("Active")}</Pill> : <Pill tone="muted">{tr("Inactive")}</Pill>}
          actions={
            <>
              <RowAction href={`/institution/programs/${p.id}`}>{tr("View")}</RowAction>
              {canEdit && <RowAction href={`/institution/programs/${p.id}/edit`}>{tr("Edit")}</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(p.id, p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {p.status === "ACTIVE" ? tr("Deactivate") : tr("Activate")}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
