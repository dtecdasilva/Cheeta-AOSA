"use client";

import Link from "next/link";
import { useRuns } from "@/lib/institution/deliberation";
import { Card, Pill } from "@/components/ui";
import { FormError } from "@/components/Form";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/** The institution's deliberation runs (/api/institution/deliberation/runs), newest first. */
export default function DeliberationsList() {
  const tr = useT();
  const { data: runs, error } = useRuns();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold tracking-tight text-xl">{tr("Deliberations")}</h2>
        <div className="flex gap-4 text-sm">
          <Link href="/institution/rules" className="underline">
            {tr("Admission rules")}
          </Link>
          <Link href="/institution/deliberations/run" className="font-medium underline">
            {tr("Run deliberation")}
          </Link>
        </div>
      </div>

      {error && <FormError>{error}</FormError>}
      {runs?.length === 0 && <Card padded>{tr("No deliberation runs yet.")}</Card>}

      <div className="space-y-3">
        {runs?.map((r) => (
          <Card key={r.id} padded>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{tr("Run {id}", { id: r.runNumber })}</span>
                  {r.status === "PUBLISHED" ? <Pill tone="success">{tr("Published")}</Pill> : r.latest ? <Pill tone="warning">{tr("Not published")}</Pill> : <Pill tone="muted">{tr("Superseded")}</Pill>}
                </div>
                <div className="text-sm text-[var(--color-ink-soft)]">{formatDateTime(r.createdAt)}</div>
                <div className="mt-2 text-xs text-[var(--color-ink-soft)]">
                  {tr("{listed} on the list · {admitted} admitted · {unsuccessful} not admitted", { listed: r.summary.listed, admitted: r.summary.admitted.total, unsuccessful: r.summary.unsuccessful })}
                  {r.summary.rankBy ? ` · ${tr("ranked by {criterion}", { criterion: tr(r.summary.rankBy.label) })}` : ""}
                </div>
                {r.notes && <div className="mt-1 text-xs text-[var(--color-ink-soft)]">{r.notes}</div>}
              </div>
              <Link href={`/institution/deliberations/${r.id}`} className="shrink-0 text-sm underline">
                {tr("View results")}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
