"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import type { Department, Faculty } from "@/lib/institution/types";
import { Pill, Row, RowAction } from "@/components/ui";
import { FilterBar, FilterSelect, Pager, ResultCount, SearchField, usePaged } from "@/components/admin/ui";
import { matchesQuery, STATUS_FILTER_OPTIONS } from "@/lib/institution/filter";
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
  const [search, setSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const visible = (items ?? []).filter(
    (d) => (!facultyFilter || d.facultyId === facultyFilter) && (!statusFilter || d.status === statusFilter) && matchesQuery(search, d.name, d.code, d.head, facultyName(d.facultyId), townName(d.townId))
  );
  const filtersActive = Boolean(search || facultyFilter || statusFilter);
  const clearFilters = () => {
    setSearch("");
    setFacultyFilter("");
    setStatusFilter("");
  };
  const { slice, ...pager } = usePaged(visible, 20);

  return (
    <InstitutionListShell title={tr("Departments")} addHref="/institution/departments/add" addLabel={tr("Add department")} emptyMessage={tr("No departments yet.")} canEdit={canEdit} loading={!items && !error} error={error} isEmpty={items?.length === 0} noMatches={visible.length === 0} summary={<ResultCount shown={visible.length} total={items?.length ?? 0} noun={tr(items?.length === 1 ? "department" : "departments")} />} footer={<Pager {...pager} />} filters={
        <FilterBar onClear={clearFilters} active={filtersActive}>
          <SearchField value={search} onChange={setSearch} placeholder="Search by name, code, head or faculty" />
          <FilterSelect label="Faculty / School" value={facultyFilter} onChange={setFacultyFilter} allLabel="All faculties" options={(faculties ?? []).map((f) => ({ value: f.id, label: f.name }))} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} />
        </FilterBar>
      }>
      {slice.map((d) => (
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
