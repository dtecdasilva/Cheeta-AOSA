"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { FilterBar, FilterSelect, Pager, ResultCount, SearchField, usePaged } from "@/components/admin/ui";
import { useDocumentSubjects } from "@/lib/documents/api";
import { matchesSearch } from "@/lib/admin/filters";
import { useT } from "@/lib/i18n/client";

/**
 * The applications whose documents the signed-in staff member may open,
 * from /api/documents: an institution's submitted applications with an
 * approved fee; every one for Cheeta administration.
 */
export function DocumentPicker({ basePath, institutionId }: { basePath: string; institutionId?: string }) {
  const tr = useT();
  const { data, error, loading } = useDocumentSubjects();
  const [search, setSearch] = useState("");
  const [inst, setInst] = useState("");
  const rows = data ?? [];
  const filtered = rows.filter((r) => (!inst || r.institutionId === inst) && matchesSearch(search, [r.studentName, r.registrationNo, r.applicationId, r.programName]));
  const { slice, page, pages, setPage } = usePaged(filtered, 25);
  const institutions = [...new Map(rows.map((r) => [r.institutionId, r.institutionName])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));

  if (loading) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  if (error) return <EmptyState message={tr(error)} />;
  return (
    <>
      <FilterBar active={!!(search || inst)} onClear={() => { setSearch(""); setInst(""); }}>
        <SearchField value={search} onChange={setSearch} placeholder={tr("Student, registration no. or Application ID")} />
        {!institutionId && <FilterSelect label={tr("Institution")} value={inst} onChange={setInst} options={institutions} />}
      </FilterBar>
      <ResultCount shown={filtered.length} total={rows.length} noun={tr("applications")} />
      {filtered.length === 0 ? (
        <EmptyState message={tr("No applications match.")} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Student")}</Th>
              <Th>{tr("Application ID")}</Th>
              {!institutionId && <Th>{tr("Institution")}</Th>}
              <Th>{tr("Program")}</Th>
              <Th>{tr("Status")}</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`${basePath}/${r.id}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                    {tr(r.studentName)}
                  </Link>
                  {r.registrationNo && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(r.registrationNo)}</p>}
                </Td>
                <Td className="text-[var(--color-ink-soft)]">{r.applicationId}</Td>
                {!institutionId && <Td>{r.institutionName}</Td>}
                <Td>{r.programName}</Td>
                <Td className="text-[var(--color-ink-soft)]">{r.statusLabel}</Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}
