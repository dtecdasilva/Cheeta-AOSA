"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, FileText, Lock, Printer } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge, usePaged, type Stat } from "@/components/admin/ui";
import { EMPTY_RANGE, describeRange, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { formatDateTime } from "@/lib/utils";

/**
 * One report: a table with search, filters, a date range, sortable columns
 * and export. Everything a report differs by lives in its ReportDef.
 *
 * Rows marked `masked` are shown — and exported — as the student's masked
 * name and "Awaiting payment", nothing more. Filters other than search
 * don't match them (they'd reveal the hidden values).
 */

export interface Column<R> {
  key: string;
  label: string;
  align?: "right";
  /** Value used to sort. Omit to make the column unsortable. */
  sort?: (r: R) => string | number | null;
  /** Plain text for CSV/Excel. */
  text: (r: R) => string;
  render?: (r: R) => React.ReactNode;
  /** Hidden in the institution portal. */
  adminOnly?: boolean;
  /** Hidden in the admin portal. */
  institutionOnly?: boolean;
}

export interface FilterDef<R> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  test: (r: R, value: string) => boolean;
  adminOnly?: boolean;
}

export interface ReportDef<R extends { id: string; masked: boolean; maskedName: string }> {
  key: string;
  title: string;
  description: string;
  noun: string;
  dateLabel: string;
  date: (r: R) => string | null;
  search: (r: R) => (string | null | undefined)[];
  columns: Column<R>[];
  filters: FilterDef<R>[];
  stats: (rows: R[], scope: Scope) => Stat[];
  defaultSort: { key: string; dir: "asc" | "desc" };
  /** Hidden from the institution portal entirely. */
  adminOnly?: boolean;
}

export type Scope = "admin" | "institution";

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function csvCell(v: string) {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const exportClass =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40";

// ---------------------------------------------------------------------------

export function ReportScreen<R extends { id: string; masked: boolean; maskedName: string }>({ def, rows, scope }: { def: ReportDef<R>; rows: R[]; scope: Scope }) {
  const columns = def.columns.filter((c) => (scope === "admin" ? !c.institutionOnly : !c.adminOnly));
  const filters = def.filters.filter((f) => scope === "admin" || !f.adminOnly);

  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [sort, setSort] = useState(def.defaultSort);
  const [printing, setPrinting] = useState(false);

  const anyFilter = Object.values(values).some(Boolean) || !!range.from || !!range.to;

  const filtered = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    const out = rows.filter((r) => {
      if (r.masked) return !anyFilter && matchesSearch(search, [r.maskedName]);
      if (!inRange(def.date(r), range)) return false;
      for (const f of filters) {
        const v = values[f.key];
        if (v && !f.test(r, v)) return false;
      }
      return matchesSearch(search, def.search(r));
    });
    if (col?.sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      out.sort((a, b) => {
        // Masked rows always sit at the bottom; they have nothing to sort on.
        if (a.masked !== b.masked) return a.masked ? 1 : -1;
        const x = col.sort!(a);
        const y = col.sort!(b);
        if (x === y) return 0;
        if (x === null || x === "") return 1;
        if (y === null || y === "") return -1;
        return (x < y ? -1 : 1) * dir;
      });
    }
    return out;
  }, [rows, search, values, range, sort, columns, filters, def, anyFilter]);

  const paged = usePaged(filtered, 25);
  const visible = printing ? filtered : paged.slice;

  // Print the whole filtered set, not just the current page.
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
    return () => clearTimeout(t);
  }, [printing]);

  const header = columns.map((c) => c.label);
  const matrix = () => filtered.map((r) => (r.masked ? [r.maskedName, "Awaiting payment", ...columns.slice(2).map(() => "")] : columns.map((c) => c.text(r))));
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `cheeta-${def.key}-report-${stamp}`;

  function exportCsv() {
    const lines = [header, ...matrix()].map((row) => row.map(csvCell).join(","));
    // BOM so Excel opens accented names (Nadège, Aïssatou) correctly.
    download("\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8", `${filename}.csv`);
  }

  function exportExcel() {
    const table = `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${matrix()
      .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${esc(def.title.slice(0, 30))}</x:Name><x:WorksheetOptions/></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${table}</body></html>`;
    download(html, "application/vnd.ms-excel", `${filename}.xls`);
  }

  const activeFilterText = [
    search && `search “${search}”`,
    ...filters.filter((f) => values[f.key]).map((f) => `${f.label.toLowerCase()}: ${f.options.find((o) => o.value === values[f.key])?.label ?? values[f.key]}`),
    `${def.dateLabel.toLowerCase()}: ${describeRange(range)}`,
  ]
    .filter(Boolean)
    .join("; ");

  return (
    <>
      <div className="no-print">
        <StatStrip columns={4} stats={def.stats(filtered.filter((r) => !r.masked), scope)} />
      </div>

      <div className="no-print mt-6">
        <FilterBar active={!!search || anyFilter} onClear={() => { setSearch(""); setValues({}); setRange(EMPTY_RANGE); }}>
          <SearchField value={search} onChange={setSearch} placeholder={`Search ${def.noun}`} />
          {filters.map((f) => (
            <FilterSelect key={f.key} label={f.label} value={values[f.key] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} options={f.options} />
          ))}
          <DateRangeFilter value={range} onChange={setRange} label={def.dateLabel} />
        </FilterBar>
      </div>

      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3">
        <ResultCount shown={filtered.length} total={rows.length} noun={def.noun} />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export">
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className={exportClass}>
            <FileText className="h-4 w-4" strokeWidth={1.75} />
            Export CSV
          </button>
          <button type="button" onClick={exportExcel} disabled={filtered.length === 0} className={exportClass}>
            <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />
            Export Excel
          </button>
          <button type="button" onClick={() => setPrinting(true)} disabled={filtered.length === 0} className={exportClass}>
            <Printer className="h-4 w-4" strokeWidth={1.75} />
            Print or save as PDF
          </button>
        </div>
      </div>

      <div className="print-area">
        <div className="print-only mb-4">
          <p className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">Cheeta AOSA — {def.title} report</p>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {filtered.length} {def.noun}. {activeFilterText}. Generated {formatDateTime(new Date().toISOString())}.
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message={rows.length === 0 ? `No ${def.noun} yet.` : `No ${def.noun} match these filters.`} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {columns.map((c) => {
                    const active = sort.key === c.key;
                    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                        className={`whitespace-nowrap border-b border-[var(--color-line)] px-4 py-2.5 text-xs font-normal text-[var(--color-ink-faint)] ${c.align === "right" ? "text-right" : "text-left"}`}
                      >
                        {c.sort ? (
                          <button
                            type="button"
                            onClick={() => setSort({ key: c.key, dir: active && sort.dir === "asc" ? "desc" : active ? "asc" : c.align === "right" ? "desc" : "asc" })}
                            className={`inline-flex items-center gap-1 hover:text-[var(--color-ink)] ${active ? "text-[var(--color-ink)]" : ""} ${c.align === "right" ? "flex-row-reverse" : ""}`}
                          >
                            {c.label}
                            <Icon className="no-print h-3 w-3" strokeWidth={2} aria-hidden />
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) =>
                  r.masked ? (
                    <tr key={r.id}>
                      <td className="border-b border-[var(--color-line)] px-4 py-2.5">
                        <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                          <Lock className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden />
                          {r.maskedName}
                        </span>
                      </td>
                      <td colSpan={columns.length - 1} className="border-b border-[var(--color-line)] px-4 py-2.5">
                        <ToneBadge tone="info">Awaiting payment</ToneBadge>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="align-top">
                      {columns.map((c) => (
                        <td key={c.key} className={`border-b border-[var(--color-line)] px-4 py-2.5 ${c.align === "right" ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                          {c.render ? c.render(r) : c.text(r) || <span className="text-[var(--color-ink-faint)]">—</span>}
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!printing && (
        <div className="no-print">
          <Pager page={paged.page} pages={paged.pages} setPage={paged.setPage} />
        </div>
      )}
    </>
  );
}
