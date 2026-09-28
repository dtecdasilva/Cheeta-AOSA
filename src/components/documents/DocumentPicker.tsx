"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { FilterBar, FilterSelect, Pager, ResultCount, SearchField, ToneBadge, usePaged } from "@/components/admin/ui";
import { institutionTuitionView, tuitionStore } from "@/lib/tuition/data";
import { matriculationStore } from "@/lib/matriculation/data";
import { institutionStore } from "@/lib/admin/institutions";
import { matchesSearch } from "@/lib/admin/filters";

/** Choose an admitted student to open their documents. */
export function DocumentPicker({ basePath, institutionId }: { basePath: string; institutionId?: string }) {
  const accounts = tuitionStore.useItems();
  const matric = matriculationStore.useItems();
  const institutions = institutionStore.useItems();
  const instName = useMemo(() => new Map(institutions.map((i) => [i.id, i.name])), [institutions]);
  const matriculated = useMemo(() => new Set(matric.map((m) => m.id)), [matric]);
  const [search, setSearch] = useState("");
  const [inst, setInst] = useState("");

  const rows = useMemo(
    () =>
      accounts
        .filter((a) => !institutionId || a.institutionId === institutionId)
        .map((a) => ({ a, masked: !!institutionId && institutionTuitionView(a).masked }))
        .sort((x, y) => Number(x.masked) - Number(y.masked) || x.a.studentName.localeCompare(y.a.studentName)),
    [accounts, institutionId]
  );
  const filtered = rows.filter(
    ({ a, masked }) =>
      (!inst || a.institutionId === inst) &&
      (masked ? !inst && matchesSearch(search, [institutionTuitionView(a).displayName]) : matchesSearch(search, [a.studentName, a.registrationNo, a.applicationRef, a.programName]))
  );
  const { slice, page, pages, setPage } = usePaged(filtered, 25);

  return (
    <>
      <FilterBar active={!!(search || inst)} onClear={() => { setSearch(""); setInst(""); }}>
        <SearchField value={search} onChange={setSearch} placeholder="Student, registration no. or application" />
        {!institutionId && (
          <FilterSelect label="Institution" value={inst} onChange={setInst} options={[...new Set(accounts.map((a) => a.institutionId))].map((id) => ({ value: id, label: instName.get(id) ?? id })).sort((a, b) => a.label.localeCompare(b.label))} />
        )}
      </FilterBar>
      <ResultCount shown={filtered.length} total={rows.length} noun="admitted students" />
      {filtered.length === 0 ? (
        <EmptyState message="No students match." />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Student</Th>
              {!institutionId && <Th>Institution</Th>}
              <Th>Program</Th>
              <Th>Documents</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map(({ a, masked }) =>
              masked ? (
                <tr key={a.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                      <Lock className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden />
                      {institutionTuitionView(a).displayName}
                    </span>
                  </Td>
                  <Td colSpan={2}>
                    <ToneBadge tone="info">Awaiting payment</ToneBadge>
                  </Td>
                </tr>
              ) : (
                <tr key={a.id}>
                  <Td>
                    <Link href={`${basePath}/${a.id}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                      {a.studentName}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{a.registrationNo}</p>
                  </Td>
                  {!institutionId && <Td>{instName.get(a.institutionId) ?? a.institutionId}</Td>}
                  <Td>{a.programName}</Td>
                  <Td className="text-[var(--color-ink-soft)]">{matriculated.has(a.id) ? "All six" : "Five of six (not matriculated)"}</Td>
                </tr>
              )
            )}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}
