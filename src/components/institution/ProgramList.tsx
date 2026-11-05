"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useInstitutionList, useOptions } from "@/lib/institution/api";
import type { Department, Faculty, Program } from "@/lib/institution/types";
import { Pill, Row, RowAction } from "@/components/ui";
import { FilterBar, FilterSelect, Pager, ResultCount, SearchField, usePaged } from "@/components/admin/ui";
import { matchesQuery, STATUS_FILTER_OPTIONS } from "@/lib/institution/filter";
import { InstitutionListShell } from "./InstitutionListShell";
import { useT } from "@/lib/i18n/client";

/** The institution's study programs, from /api/institution/programs. */
export default function ProgramList() {
  const tr = useT();
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus } = useInstitutionList<Program>("programs");
  const { items: departments } = useInstitutionList<Department>("departments");
  const { items: faculties } = useInstitutionList<Faculty>("faculties");
  const qualifications = useOptions<{ id: string; label: string }>("/api/reference/parameters?category=qualification-types");
  const departmentName = (id: string) => departments?.find((d) => d.id === id)?.name;
  const qualificationName = (id: string) => qualifications.find((q) => q.id === id)?.label;
  const facultyName = (id: string) => faculties?.find((f) => f.id === id)?.name;
  const [search, setSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [qualificationFilter, setQualificationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // The department choices follow the faculty chosen, so the two can never contradict each other.
  const departmentOptions = (departments ?? []).filter((d) => !facultyFilter || d.facultyId === facultyFilter);
  const visible = (items ?? []).filter(
    (p) =>
      (!facultyFilter || p.facultyId === facultyFilter) &&
      (!departmentFilter || p.departmentId === departmentFilter) &&
      (!qualificationFilter || p.qualificationId === qualificationFilter) &&
      (!statusFilter || p.status === statusFilter) &&
      matchesQuery(search, p.name, p.code, qualificationName(p.qualificationId), departmentName(p.departmentId), facultyName(p.facultyId))
  );
  const filtersActive = Boolean(search || facultyFilter || departmentFilter || qualificationFilter || statusFilter);
  const clearFilters = () => {
    setSearch("");
    setFacultyFilter("");
    setDepartmentFilter("");
    setQualificationFilter("");
    setStatusFilter("");
  };
  const { slice, ...pager } = usePaged(visible, 20);

  return (
    <InstitutionListShell title={tr("Study programs")} addHref="/institution/programs/add" addLabel={tr("Add program")} emptyMessage={tr("No study programs yet.")} canEdit={canEdit} loading={!items && !error} error={error} isEmpty={items?.length === 0} noMatches={visible.length === 0} summary={<ResultCount shown={visible.length} total={items?.length ?? 0} noun={tr(items?.length === 1 ? "program" : "programs")} />} footer={<Pager {...pager} />} filters={
        <FilterBar onClear={clearFilters} active={filtersActive}>
          <SearchField value={search} onChange={setSearch} placeholder="Search by name, code, qualification or department" />
          <FilterSelect
            label="Faculty / School"
            value={facultyFilter}
            onChange={(v) => {
              setFacultyFilter(v);
              setDepartmentFilter("");
            }}
            allLabel="All faculties"
            options={(faculties ?? []).map((f) => ({ value: f.id, label: f.name }))}
          />
          <FilterSelect label="Department" value={departmentFilter} onChange={setDepartmentFilter} allLabel="All departments" options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label="Qualification" value={qualificationFilter} onChange={setQualificationFilter} allLabel="All qualifications" options={qualifications.map((q) => ({ value: q.id, label: q.label }))} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} />
        </FilterBar>
      }>
      {slice.map((p) => (
        <Row
          key={p.id}
          title={tr(p.name)}
          subtitle={[p.code, qualificationName(p.qualificationId), departmentName(p.departmentId), String(p.availableSpaces === 1 ? tr("1 space") : tr("{n} spaces", { n: p.availableSpaces }))].filter(Boolean).join(" · ")}
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
