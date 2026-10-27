"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runDeliberation } from "@/lib/institution/deliberation";
import { useRuleOptions, useRules } from "@/lib/institution/rules";
import { Card, RowAction } from "@/components/ui";
import { Field, FormError, SelectInput, TextArea, PrimaryButton } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

/**
 * Runs the deliberation over the Deliberation List with every active
 * admission rule (POST /api/institution/deliberation/runs). Where a program
 * has fewer places than qualified applicants, they are ranked by the
 * criterion chosen here, then by date of submission. A run only proposes:
 * nothing is offered until it is published.
 */
export default function RunDeliberation() {
  const tr = useT();
  const router = useRouter();
  const { data: rules } = useRules();
  const { data: options } = useRuleOptions();
  const [rankBy, setRankBy] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = (rules ?? []).filter((r) => r.status === "ACTIVE");
  const rankable = (options?.criteria ?? []).filter((c) => c.kind === "number" || c.kind === "grade");

  async function run() {
    setBusy(true);
    setError(null);
    const r = await runDeliberation({ rankBy: rankBy || undefined, notes: notes || undefined });
    setBusy(false);
    if (r.ok) router.push(`/institution/deliberations/${r.data.id}`);
    else {
      setError(r.error);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="font-medium">{tr("Rules that will be applied")}</p>
        {!rules && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>}
        {rules && active.length === 0 && (
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {tr("No active rules: everyone who meets the general conditions competes for their choices' places.")}{" "}
            <Link href="/institution/rules" className="underline">
              {tr("Admission rules")}
            </Link>
          </p>
        )}
        <ul className="mt-2 space-y-1 text-sm">
          {active.map((r) => (
            <li key={r.id}>
              <span className="font-medium">{r.name}</span> <span className="text-[var(--color-ink-soft)]">{tr("(version {version})", { version: r.current?.version ?? 1 })}</span>
              {r.current && <span className="text-[var(--color-ink-soft)]"> — {r.current.summary}</span>}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Field label={tr("Rank applicants by")} hint={tr("Used where a program has fewer places than qualified applicants. Ties, and runs without a criterion, go by date of submission.")}>
          <SelectInput value={rankBy} onChange={(e) => setRankBy(e.target.value)}>
            <option value="">{tr("Date of submission only")}</option>
            {rankable.map((c) => (
              <option key={c.key} value={c.key}>
                {tr(c.group)}: {tr(c.label)}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label={tr("Notes (optional)")}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <FormError>{error}</FormError>}
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={() => setConfirming(true)} disabled={busy}>
            {tr("Run deliberation")}
          </PrimaryButton>
          <RowAction onClick={() => router.push("/institution/deliberations")}>{tr("Cancel")}</RowAction>
        </div>
      </Card>

      {confirming && (
        <Card>
          <div className="text-sm">{tr("Run the deliberation now? Every applicant on the Deliberation List is assessed. Nothing is offered until you publish the run.")}</div>
          <div className="mt-3 flex items-center gap-3">
            <PrimaryButton onClick={run} disabled={busy}>
              {busy ? tr("Running…") : tr("Confirm and run")}
            </PrimaryButton>
            <RowAction onClick={() => setConfirming(false)}>{tr("Cancel")}</RowAction>
          </div>
        </Card>
      )}
    </div>
  );
}
