"use client";

import { Fragment, useEffect, useState } from "react";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, SearchField } from "@/components/admin/ui";
import { PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { FormError } from "@/components/Form";
import { AUDIT_CATEGORIES } from "@/lib/audit/categories";
import type { DateRange } from "@/lib/admin/filters";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface Entry {
  id: string;
  at: string;
  category: string;
  categoryLabel: string;
  action: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorRole: string | null;
  entityType: string;
  entityId: string | null;
  institutionId: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  requestId: string | null;
}

const PAGE_SIZE = 50;
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/**
 * The audit trail, from /api/admin/audit-log (Cheeta administration: every
 * institution, with an institution filter) or /api/institution/audit-log
 * (an institution administrator: their own institution only). The server
 * decides the scope from the session; entries can't be changed or deleted.
 */
export function AuditLog({ scope, institutions = [] }: { scope: "admin" | "institution"; institutions?: { value: string; label: string }[] }) {
  const tr = useT();
  const base = scope === "admin" ? "/api/admin/audit-log" : "/api/institution/audit-log";
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Search waits for typing to pause.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [q, category, institutionId, range.from, range.to]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (institutionId) params.set("institutionId", institutionId);
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const url = `${base}?${params}`;

  useEffect(() => {
    let live = true;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) return setError(body.error ?? "The audit trail could not be loaded.");
        setRows(body.data);
        setTotal(body.meta.total);
        setError(null);
      })
      .catch(() => live && setError("The audit trail could not be loaded. Check your connection."));
    return () => {
      live = false;
    };
  }, [url]);

  const csv = new URLSearchParams(params);
  csv.delete("page");
  csv.delete("pageSize");
  csv.set("format", "csv");
  csv.set("pageSize", "5000");

  return (
    <>
      <PageHeading
        title={tr("Audit log")}
        description={scope === "admin" ? tr("Every recorded action on the platform: who did what, to which record, and when. Entries can't be changed or deleted.") : tr("Every recorded action at your institution: who did what, to which record, and when. Entries can't be changed or deleted.")}
        actions={
          <a href={`${base}?${csv}`} className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
            {tr("Export CSV")}
          </a>
        }
      />
      <FilterBar
        active={!!(search || category || institutionId || range.from || range.to)}
        onClear={() => {
          setSearch("");
          setCategory("");
          setInstitutionId("");
          setRange({ from: "", to: "" });
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder={tr("Person, action, record or id")} />
        <DateRangeFilter value={range} onChange={setRange} />
        <FilterSelect label={tr("Category")} value={category} onChange={setCategory} options={Object.entries(AUDIT_CATEGORIES).map(([value, label]) => ({ value, label: tr(label) }))} />
        {scope === "admin" && <FilterSelect label={tr("Institution")} value={institutionId} onChange={setInstitutionId} options={institutions} />}
      </FilterBar>

      {error && <FormError>{error}</FormError>}
      <p className="mb-2 text-sm text-[var(--color-ink-soft)]" aria-live="polite">
        {rows ? tr("{total} entries", { total }) : tr("Loading…")}
      </p>
      <TableFrame>
        <thead>
          <tr>
            <Th>{tr("When")}</Th>
            <Th>{tr("Who")}</Th>
            <Th>{tr("Category")}</Th>
            <Th>{tr("Action")}</Th>
            <Th>{tr("Record")}</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {rows?.length === 0 && (
            <tr>
              <Td colSpan={6} className="py-8 text-center text-[var(--color-ink-soft)]">
                {tr("No entries match these filters.")}
              </Td>
            </tr>
          )}
          {rows?.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <Td className="whitespace-nowrap text-xs">{formatDateTime(r.at)}</Td>
                <Td>
                  <span className="text-sm">{r.actorLabel ?? r.actorUserId ?? tr("The platform")}</span>
                  {r.actorRole && <span className="block text-xs text-[var(--color-ink-soft)]">{r.actorRole}</span>}
                </Td>
                <Td>{r.categoryLabel}</Td>
                <Td className="font-mono text-xs">{r.action}</Td>
                <Td>
                  <span className="text-sm">{r.entityType}</span>
                  {r.entityId && <span className="block font-mono text-xs text-[var(--color-ink-soft)]">{r.entityId}</span>}
                </Td>
                <Td className="text-right">
                  <button type="button" className="text-sm underline" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    {open === r.id ? tr("Hide") : tr("Details")}
                  </button>
                </Td>
              </tr>
              {open === r.id && (
                <tr>
                  <Td colSpan={6}>
                    <div className="space-y-2 text-xs">
                      {r.changes && Object.keys(r.changes).length > 0 && (
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-[var(--color-ink-soft)]">
                              <th className="pr-3 font-medium">{tr("Field")}</th>
                              <th className="pr-3 font-medium">{tr("Before")}</th>
                              <th className="font-medium">{tr("After")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(r.changes).map(([k, c]) => (
                              <tr key={k} className="align-top">
                                <td className="pr-3 font-mono">{k}</td>
                                <td className="max-w-xs break-words pr-3">{show(c.from)}</td>
                                <td className="max-w-xs break-words">{show(c.to)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {r.meta && Object.keys(r.meta).length > 0 && <p className="break-words text-[var(--color-ink-soft)]">{show(r.meta)}</p>}
                      <p className="text-[var(--color-ink-faint)]">
                        {r.institutionId ? `${tr("Institution")}: ${r.institutionId} · ` : ""}
                        {r.ip ? `IP ${r.ip} · ` : ""}
                        {r.requestId ? `${tr("Request")} ${r.requestId}` : ""}
                      </p>
                    </div>
                  </Td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </TableFrame>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} setPage={setPage} />
    </>
  );
}
