"use client";

import Link from "next/link";
import { useMemo } from "react";
import { findRulesForInstitution, AdmissionRule } from "@/lib/mockData/admissionRules";
import { Card, CardHeader } from "@/components/ui";

export default function RulesList({ institutionId }: { institutionId: string }) {
  const rules = useMemo(() => findRulesForInstitution(institutionId), [institutionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[var(--font-display)] text-xl">Admission rules</h2>
        <Link href="/institution/rules/add" className="text-sm underline">Create rule</Link>
      </div>

      {rules.length === 0 && <Card padded={true}>No rules configured for this institution.</Card>}

      <div className="space-y-3">
        {rules.map((r: AdmissionRule) => (
          <Card key={r.id} padded={true}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{r.name}</div>
                {r.description && <div className="text-sm text-[var(--color-ink-soft)]">{r.description}</div>}
                <div className="text-xs text-[var(--color-ink-soft)] mt-2">Version: {r.latestVersion.id}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link href={`/institution/rules/${r.id}`} className="text-sm underline">View</Link>
                <Link href={`/institution/rules/${r.id}/edit`} className="text-sm underline">Edit</Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
