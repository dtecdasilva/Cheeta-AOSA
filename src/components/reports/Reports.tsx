"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormError, SelectInput } from "@/components/Form";
import { ReportScreen, type Scope } from "./ReportScreen";
import { reportFromRows, reportsFor, type ReportKey } from "./definitions";
import { useT } from "@/lib/i18n/client";

/**
 * Reports from the database (/api/reports). The server decides what each
 * person may see: an institution gets its own rows only, with students
 * awaiting payment approval already masked. The screen then filters, sorts
 * and narrows by date over what it was sent; the same filters, sorting and
 * date ranges are available from the API itself, and as CSV.
 */

function useReportRows(key: ReportKey, pageSize = 5000) {
  const [state, setState] = useState<{ rows: unknown[] | null; total: number; error: string | null }>({ rows: null, total: 0, error: null });
  useEffect(() => {
    let live = true;
    setState({ rows: null, total: 0, error: null });
    fetch(`/api/reports/${key}?pageSize=${pageSize}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { data?: unknown[]; meta?: { total: number }; error?: string };
        if (!live) return;
        setState(res.ok ? { rows: body.data ?? [], total: body.meta?.total ?? 0, error: null } : { rows: null, total: 0, error: body.error ?? "This report couldn't be loaded." });
      })
      .catch(() => live && setState({ rows: null, total: 0, error: "Couldn't reach the server. Check your connection." }));
    return () => {
      live = false;
    };
  }, [key, pageSize]);
  return state;
}

const TITLES = (scope: Scope) => reportsFor(scope).map((k) => ({ key: k, def: reportFromRows(k, []).def }));

function IndexCard({ k, basePath }: { k: ReportKey; basePath: string }) {
  const tr = useT();
  const { def } = useMemo(() => reportFromRows(k, []), [k]);
  const { total, rows } = useReportRows(k, 1);
  return (
    <Link href={`${basePath}/${k}`} className="flex h-full flex-col px-5 py-5 transition-colors hover:bg-[var(--color-paper)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr(def.title)}</p>
        <p className="shrink-0 font-bold tracking-tight text-2xl tabular-nums text-[var(--color-ink)]">{rows ? total : "…"}</p>
      </div>
      <p className="mt-1.5 flex-1 text-sm text-[var(--color-ink-soft)]">{tr(def.description)}</p>
      <p className="mt-3 text-xs text-[var(--color-ink-faint)]">{tr(def.noun)}</p>
    </Link>
  );
}

export function ReportsIndex({ scope, basePath }: { scope: Scope; basePath: string; institutionId?: string }) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 xl:grid-cols-3">
      {reportsFor(scope).map((k) => (
        <li key={k} className="bg-[var(--color-surface)]">
          <IndexCard k={k} basePath={basePath} />
        </li>
      ))}
    </ul>
  );
}

export function ReportView({ reportKey, scope, basePath }: { reportKey: ReportKey; scope: Scope; basePath: string; institutionId?: string }) {
  const tr = useT();
  const router = useRouter();
  const { rows, error } = useReportRows(reportKey);
  const report = useMemo(() => reportFromRows(reportKey, rows ?? []), [reportKey, rows]);
  const titles = useMemo(() => TITLES(scope), [scope]);

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          {tr("All reports")}
        </Link>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
          {tr("Switch report")}
          <SelectInput value={reportKey} onChange={(e) => router.push(`${basePath}/${e.target.value}`)} className="w-56">
            {titles.map((t) => (
              <option key={t.key} value={t.key}>
                {tr(t.def.title)}
              </option>
            ))}
          </SelectInput>
        </label>
      </div>
      <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold tracking-tight text-2xl text-[var(--color-ink)]">{tr(report.def.title)}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{tr(report.def.description)}</p>
        </div>
        <a href={`/api/reports/${reportKey}?format=csv`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
          {tr("Download all as CSV")}
        </a>
      </div>
      {error ? <FormError>{tr(error)}</FormError> : rows ? <ReportScreen key={reportKey} def={report.def} rows={report.rows} scope={scope} /> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>}
    </>
  );
}
