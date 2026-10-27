"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { publishRun, reportUrl, useRun, type RunResult } from "@/lib/institution/deliberation";
import { Card, Pill, TableFrame, Td, Th } from "@/components/ui";
import { FormError, PrimaryButton } from "@/components/Form";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

function Reasons({ r }: { r: RunResult }) {
  const tr = useT();
  const g = r.reasons?.general;
  return (
    <div className="space-y-2 text-xs text-[var(--color-ink-soft)]">
      {g && (
        <div>
          <p className="font-medium text-[var(--color-ink)]">{tr("General conditions")}</p>
          <ul className="ml-4 list-disc">
            {g.checks.map((c, i) => (
              <li key={i} className={c.pass ? "" : "text-[var(--color-danger)]"}>
                {tr(c.label)}: {c.detail}
              </li>
            ))}
            {g.rules.map((x) => (
              <li key={x.ruleId} className={x.pass ? "" : "text-[var(--color-danger)]"}>
                {x.rule} (v{x.version}): {x.outcome.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.reasons?.choices?.map((c) => (
        <div key={c.rank}>
          <p className="font-medium text-[var(--color-ink)]">
            {tr("Choice {rank}: {program}", { rank: c.rank, program: c.program })}
            {c.placed === true ? ` — ${tr("placed")}` : c.placed === false ? ` — ${tr("no place left")}` : ""}
            {c.position ? ` (${tr("{position} of {competing}", { position: c.position, competing: c.competing ?? "—" })})` : ""}
          </p>
          <ul className="ml-4 list-disc">
            {c.checks.map((x, i) => (
              <li key={i} className={x.pass ? "" : "text-[var(--color-danger)]"}>
                {tr(x.label)}: {x.detail}
              </li>
            ))}
            {c.rules.map((x) => (
              <li key={x.ruleId} className={x.pass ? "" : "text-[var(--color-danger)]"}>
                {x.rule} (v{x.version}): {x.outcome.detail}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * One deliberation run (/api/institution/deliberation/runs/:id): the report
 * at each stage, each program's places, every applicant's result with why,
 * and publishing (the latest run only, once) to make the offers.
 */
export default function DeliberationResults({ id }: { id: string }) {
  const tr = useT();
  const { data: run, error, setData } = useRun(id);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (error) return <FormError>{error}</FormError>;
  if (!run) return <Card padded>{tr("Loading…")}</Card>;
  const rep = run.report;

  async function publish() {
    setBusy(true);
    setActionError(null);
    const r = await publishRun(id);
    setBusy(false);
    setConfirm(false);
    if (!r.ok) return setActionError(r.error);
    setData(r.data);
    const p = r.data.published;
    setNotice(tr("Published. {offered} offers made.", { offered: p?.offered ?? 0 }) + (p?.skipped.length ? ` ${tr("Left as they were (decided since the run): {list}", { list: p.skipped.join(", ") })}` : ""));
  }

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{tr("Run {id}", { id: run.runNumber })}</span>
              {run.status === "PUBLISHED" ? <Pill tone="success">{tr("Published")}</Pill> : run.latest ? <Pill tone="warning">{tr("Not published")}</Pill> : <Pill tone="muted">{tr("Superseded")}</Pill>}
            </div>
            <div className="text-sm text-[var(--color-ink-soft)]">
              {tr("Created: {value}", { value: formatDateTime(run.createdAt) })}
              {run.runBy ? ` · ${run.runBy}` : ""}
              {run.publishedAt ? ` · ${tr("published {value}", { value: formatDateTime(run.publishedAt) })}` : ""}
            </div>
            {rep.rankBy && <div className="text-xs text-[var(--color-ink-soft)]">{tr("Ranked by {criterion}", { criterion: tr(rep.rankBy.label) })}</div>}
            {run.notes && <div className="mt-1 text-xs text-[var(--color-ink-soft)]">{run.notes}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href={reportUrl(run.id)} className="underline">
              {tr("Download CSV")}
            </a>
            {run.canPublish && !confirm && <PrimaryButton onClick={() => setConfirm(true)}>{tr("Publish and make offers")}</PrimaryButton>}
            {run.status === "PUBLISHED" && run.latest && (
              <Link href="/institution/admissions/provisional" className="underline">
                {tr("Make a provisional offer")}
              </Link>
            )}
          </div>
        </div>
        {confirm && (
          <div className="mt-4 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-3 text-sm">
            <p>{tr("Publishing offers a place to the {count} applicants this run admitted, and tells them. It can't be undone; to change the outcome, run the deliberation again before publishing.", { count: rep.admitted.total })}</p>
            <div className="mt-2 flex gap-3">
              <PrimaryButton disabled={busy} onClick={publish}>
                {busy ? tr("Publishing…") : tr("Publish")}
              </PrimaryButton>
              <button type="button" className="underline" onClick={() => setConfirm(false)}>
                {tr("Cancel")}
              </button>
            </div>
          </div>
        )}
        {!run.latest && run.status !== "PUBLISHED" && <p className="mt-3 text-xs text-[var(--color-ink-soft)]">{tr("A newer run has been made since. Only the latest run can be published.")}</p>}
        {actionError && <div className="mt-3"><FormError>{actionError}</FormError></div>}
        {notice && <p role="status" className="mt-3 text-sm text-[var(--color-success-strong)]">{notice}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-5">
        {[
          [tr("On the list"), rep.listed],
          [tr("Met the general conditions"), rep.passedGeneral],
          [tr("Admitted"), rep.admitted.total],
          [tr("First / second / third choice"), `${rep.admitted.firstChoice} / ${rep.admitted.secondChoice} / ${rep.admitted.thirdChoice}`],
          [tr("Not admitted"), rep.unsuccessful],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-[var(--color-surface)] px-5 py-4">
            <p className="font-bold tracking-tight text-2xl text-[var(--color-ink)]">{value}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{label}</p>
          </div>
        ))}
      </div>

      <Card>
        <p className="font-medium">{tr("Rules applied")}</p>
        {rep.rules.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{tr("None: only the general conditions and places.")}</p>
        ) : (
          <ul className="mt-1 text-sm">
            {rep.rules.map((r) => (
              <li key={r.ruleId}>
                {r.rule} (v{r.version}) <span className="text-xs text-[var(--color-ink-soft)]">· {r.kind === "GENERAL" ? tr("general condition") : tr("program requirement")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <h2 className="mb-2 font-semibold">{tr("Programs")}</h2>
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Program")}</Th>
              <Th>{tr("Places")}</Th>
              <Th>{tr("Applied")}</Th>
              <Th>{tr("Met requirements")}</Th>
              <Th>{tr("Admitted (1st / 2nd / 3rd)")}</Th>
            </tr>
          </thead>
          <tbody>
            {rep.programs.map((p) => (
              <tr key={p.programId}>
                <Td>
                  <span className="font-medium">{p.program}</span>
                  <span className="block text-xs text-[var(--color-ink-soft)]">{p.faculty} · {p.department}</span>
                </Td>
                <Td>{p.places}</Td>
                <Td>{p.applied}</Td>
                <Td>{p.metRequirements}</Td>
                <Td>
                  {p.admitted} ({p.byChoice.join(" / ")})
                </Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{tr("Applicants")}</h2>
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Applicant")}</Th>
              <Th>{tr("Application ID")}</Th>
              <Th>{tr("Outcome")}</Th>
              <Th>{tr("Program")}</Th>
              <Th>{tr("Ranking value")}</Th>
              <Th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {run.results.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-[var(--color-ink-soft)]">{tr("Nobody was on the list.")}</Td>
              </tr>
            )}
            {run.results.map((r) => (
              <Fragment key={r.applicationId}>
                <tr>
                  <Td className="font-medium">{r.applicant}</Td>
                  <Td className="font-mono text-xs">{r.applicationNumber}</Td>
                  <Td>
                    <Pill tone={r.outcome === "ACCEPTED" ? "success" : "muted"}>{r.outcome === "ACCEPTED" ? tr("Admitted") : tr("Not admitted")}</Pill>
                  </Td>
                  <Td>{r.program ? tr("Choice {rank}: {program}", { rank: r.choice ?? "—", program: r.program }) : <span className="text-xs text-[var(--color-ink-soft)]">{r.note}</span>}</Td>
                  <Td>{r.merit ?? "—"}</Td>
                  <Td className="text-right">
                    <button type="button" className="text-sm underline" onClick={() => setOpen(open === r.applicationId ? null : r.applicationId)}>
                      {open === r.applicationId ? tr("Hide") : tr("Why")}
                    </button>
                  </Td>
                </tr>
                {open === r.applicationId && (
                  <tr>
                    <Td colSpan={6}>
                      <Reasons r={r} />
                    </Td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </TableFrame>
      </section>
    </div>
  );
}
