"use client";

import Link from "next/link";
import { useRules } from "@/lib/institution/rules";
import { Card, Pill } from "@/components/ui";
import { FormError } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

/** The institution's admission rules (/api/institution/admission-rules), each with its current version. */
export default function RulesList({ canEdit }: { canEdit: boolean }) {
  const tr = useT();
  const { data: rules, error } = useRules();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight text-xl">{tr("Admission rules")}</h2>
        {canEdit && (
          <Link href="/institution/rules/add" className="text-sm underline">
            {tr("Create rule")}
          </Link>
        )}
      </div>
      <p className="text-sm text-[var(--color-ink-soft)]">{tr("Deliberation applies every active rule. A rule can apply to every program or only to some, and keeps each version it has had.")}</p>

      {error && <FormError>{error}</FormError>}
      {!rules && !error && <Card padded>{tr("Loading…")}</Card>}
      {rules?.length === 0 && <Card padded>{tr("No rules configured for this institution.")}</Card>}

      <div className="space-y-3">
        {rules?.map((r) => (
          <Card key={r.id} padded>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Pill tone={r.status === "ACTIVE" ? "success" : "muted"}>{r.status === "ACTIVE" ? tr("Active") : tr("Inactive")}</Pill>
                </div>
                {r.description && <div className="text-sm text-[var(--color-ink-soft)]">{r.description}</div>}
                {r.current && <div className="mt-2 text-sm text-[var(--color-ink)]">{r.current.summary}</div>}
                <div className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  {tr("Version {version}", { version: r.current?.version ?? 1 })} · {r.current?.appliesTo.length ? r.current.appliesTo.join(", ") : tr("Every program")}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link href={`/institution/rules/${r.id}`} className="text-sm underline">
                  {tr("View")}
                </Link>
                {canEdit && (
                  <Link href={`/institution/rules/${r.id}/edit`} className="text-sm underline">
                    {tr("Edit")}
                  </Link>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
