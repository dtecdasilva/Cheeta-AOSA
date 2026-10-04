"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SelectInput } from "@/components/Form";
import { useHydrated } from "@/lib/admin/store";
import { ReportScreen, type Scope } from "./ReportScreen";
import { buildReport, reportsFor, type ReportKey } from "./definitions";
import { useReportSources } from "./sources";

function useAllReports(scope: Scope, institutionId?: string) {
  const s = useReportSources();
  return useMemo(() => reportsFor(scope).map((k) => ({ key: k, ...buildReport(k, s, institutionId) })), [s, scope, institutionId]);
}

export function ReportsIndex({ scope, basePath, institutionId }: { scope: Scope; basePath: string; institutionId?: string }) {
  const reports = useAllReports(scope, institutionId);
  return (
    <ul className="grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 xl:grid-cols-3">
      {reports.map((r) => (
        <li key={r.key} className="bg-[var(--color-surface)]">
          <Link href={`${basePath}/${r.key}`} className="flex h-full flex-col px-5 py-5 transition-colors hover:bg-[var(--color-paper)]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{r.def.title}</p>
              <p className="shrink-0 font-bold tracking-tight text-2xl tabular-nums text-[var(--color-ink)]">{r.rows.length}</p>
            </div>
            <p className="mt-1.5 flex-1 text-sm text-[var(--color-ink-soft)]">{r.def.description}</p>
            <p className="mt-3 text-xs text-[var(--color-ink-faint)]">{r.def.noun}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ReportView({ reportKey, scope, basePath, institutionId }: { reportKey: ReportKey; scope: Scope; basePath: string; institutionId?: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const s = useReportSources();
  const report = useMemo(() => buildReport(reportKey, s, institutionId), [reportKey, s, institutionId]);
  const titles = useMemo(() => reportsFor(scope).map((k) => ({ key: k, title: buildReport(k, s, institutionId).def.title })), [scope, s, institutionId]);

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          All reports
        </Link>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
          Switch report
          <SelectInput value={reportKey} onChange={(e) => router.push(`${basePath}/${e.target.value}`)} className="w-56">
            {titles.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </SelectInput>
        </label>
      </div>
      <div className="no-print mb-6">
        <h1 className="font-bold tracking-tight text-2xl text-[var(--color-ink)]">{report.def.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{report.def.description}</p>
      </div>
      {/* Stored changes live in this browser; wait so the first paint isn't seed data. */}
      {hydrated ? <ReportScreen key={reportKey} def={report.def} rows={report.rows} scope={scope} /> : <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>}
    </>
  );
}
