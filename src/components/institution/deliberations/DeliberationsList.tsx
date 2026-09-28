"use client";

import Link from "next/link";
import { useMemo } from "react";
import { findRunsForInstitution } from "@/lib/mockData/deliberations";
import { Card } from "@/components/ui";

export default function DeliberationsList({ institutionId }: { institutionId: string }) {
  const runs = useMemo(() => findRunsForInstitution(institutionId), [institutionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[var(--font-display)] text-xl">Deliberations</h2>
        <Link href="/institution/deliberations/run" className="text-sm underline">Run deliberation</Link>
      </div>

      {runs.length === 0 && <Card padded={true}>No deliberation runs yet.</Card>}

      <div className="space-y-3">
        {runs.map((r) => (
          <Card key={r.id} padded={true}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">Run {r.id}</div>
                <div className="text-sm text-[var(--color-ink-soft)]">{new Date(r.createdAt).toLocaleString()}</div>
                <div className="text-xs text-[var(--color-ink-soft)] mt-2">Rule: {r.ruleId} · version {r.ruleVersionId}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link href={`/institution/deliberations/${r.id}`} className="text-sm underline">View results</Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
