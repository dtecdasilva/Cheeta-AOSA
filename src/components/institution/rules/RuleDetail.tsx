"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Outcome } from "@/lib/admission/rules";
import { deleteRule, evaluateRule, updateRule, useRule, type Evaluation } from "@/lib/institution/rules";
import { Card, Pill } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton, TextInput } from "@/components/Form";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

function OutcomeTree({ o }: { o: Outcome }) {
  return (
    <li>
      <span className={o.pass ? "text-[var(--color-success-strong)]" : "text-[var(--color-danger)]"}>{o.pass ? "✓" : "✗"}</span> {o.detail}
      {o.children?.length ? (
        <ul className="ml-5 mt-1 space-y-1">
          {o.children.map((c, i) => (
            <OutcomeTree key={i} o={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** One rule (/api/institution/admission-rules/:id): its current version, its history, switching it on or off, and a test on an application. */
export default function RuleDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const tr = useT();
  const router = useRouter();
  const { data: rule, error, reload } = useRule(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [appId, setAppId] = useState("");
  const [result, setResult] = useState<Evaluation | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  if (error) return <FormError>{error}</FormError>;
  if (!rule) return <Card padded>{tr("Loading…")}</Card>;

  async function setStatus(status: "ACTIVE" | "INACTIVE") {
    const r = await updateRule(id, { status });
    if (r.ok) reload();
    else setActionError(r.error);
  }
  async function remove() {
    if (!window.confirm(tr("Delete this rule? This can't be undone."))) return;
    const r = await deleteRule(id);
    if (r.ok) router.push("/institution/rules");
    else setActionError(r.error);
  }
  async function test() {
    setTestError(null);
    setResult(null);
    const r = await evaluateRule(id, appId.trim());
    if (r.ok) setResult(r.data);
    else setTestError(r.error);
  }

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{rule.name}</span>
              <Pill tone={rule.status === "ACTIVE" ? "success" : "muted"}>{rule.status === "ACTIVE" ? tr("Active") : tr("Inactive")}</Pill>
            </div>
            {rule.description && <div className="text-sm text-[var(--color-ink-soft)]">{rule.description}</div>}
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link href={`/institution/rules/${rule.id}/edit`} className="underline">
                {tr("Edit")}
              </Link>
              <button type="button" className="underline" onClick={() => setStatus(rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                {rule.status === "ACTIVE" ? tr("Deactivate") : tr("Activate")}
              </button>
              {!rule.versions?.some((v) => v.usedByDeliberation) && (
                <button type="button" className="text-[var(--color-danger)] underline" onClick={remove}>
                  {tr("Delete")}
                </button>
              )}
            </div>
          )}
        </div>
        {actionError && <div className="mt-3"><FormError>{actionError}</FormError></div>}
      </Card>

      <Card>
        <p className="font-medium">{tr("Version {version}", { version: rule.current?.version ?? 1 })}</p>
        <p className="mt-2 text-sm">{rule.current?.summary}</p>
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{tr("Applies to: {programs}", { programs: rule.current?.appliesTo.length ? rule.current.appliesTo.join(", ") : tr("Every program") })}</p>
      </Card>

      <Card>
        <p className="font-medium">{tr("Test it on an application")}</p>
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{tr("Enter the Application ID of a submitted, paid application. Each program the applicant chose is tested.")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <TextInput value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="AOSA-2026-000123" className="max-w-xs font-mono" />
          <PrimaryButton disabled={!appId.trim()} onClick={test}>
            {tr("Test")}
          </PrimaryButton>
        </div>
        {testError && <div className="mt-3"><FormError>{testError}</FormError></div>}
        {result && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-[var(--color-ink-soft)]">{tr("Application {reference}", { reference: result.application.reference })}</p>
            {result.choices.map((c) => (
              <div key={c.programId} className="rounded-lg border border-[var(--color-line)] p-3">
                <p className="font-medium">
                  {tr("Choice {rank}: {program}", { rank: c.rank, program: c.programName })} —{" "}
                  {!c.applies ? <span className="text-[var(--color-ink-soft)]">{tr("not covered by this rule")}</span> : c.pass ? <span className="text-[var(--color-success-strong)]">{tr("meets it")}</span> : <span className="text-[var(--color-danger)]">{tr("does not meet it")}</span>}
                </p>
                {c.outcome && (
                  <ul className="mt-2 space-y-1">
                    <OutcomeTree o={c.outcome} />
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="font-medium">{tr("History")}</p>
        <ul className="mt-2 space-y-3 text-sm">
          {rule.versions?.map((v) => (
            <li key={v.id} className="border-t border-[var(--color-line)] pt-2 first:border-0 first:pt-0">
              <p>
                <span className="font-medium">{tr("Version {version}", { version: v.version })}</span>{" "}
                <span className="text-xs text-[var(--color-ink-soft)]">· {formatDateTime(v.createdAt)}{v.usedByDeliberation ? ` · ${tr("used by a deliberation")}` : ""}</span>
              </p>
              <p className="text-[var(--color-ink-soft)]">{v.summary}</p>
              {v.notes && <p className="text-xs text-[var(--color-ink-soft)]">{v.notes}</p>}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <SecondaryButton onClick={() => router.push("/institution/rules")}>{tr("Back")}</SecondaryButton>
        </div>
      </Card>
    </div>
  );
}
