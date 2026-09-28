"use client";

import { DeliberationRun } from "@/lib/mockData/deliberations";
import { Card } from "@/components/ui";

export default function DeliberationResults({ run }: { run: DeliberationRun }) {
  if (!run) return <Card padded={true}>Run not found.</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <div className="font-medium">Results for run {run.id}</div>
        <div className="text-sm text-[var(--color-ink-soft)]">Created: {new Date(run.createdAt).toLocaleString()}</div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="font-medium">Accepted ({run.accepted.length})</div>
          <ul className="mt-2 text-sm text-[var(--color-ink-soft)] space-y-1">
            {run.accepted.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="font-medium">Unsuccessful ({run.unsuccessful.length})</div>
          <ul className="mt-2 text-sm text-[var(--color-ink-soft)] space-y-1">
            {run.unsuccessful.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="font-medium">First/Second/Third breakdown</div>
          <div className="mt-2 text-sm text-[var(--color-ink-soft)]">
            <div className="mb-2">First-choice ({run.firstChoice.length}): {run.firstChoice.join(", ")}</div>
            <div className="mb-2">Second-choice ({run.secondChoice.length}): {run.secondChoice.join(", ")}</div>
            <div className="mb-2">Third-choice ({run.thirdChoice.length}): {run.thirdChoice.join(", ")}</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="font-medium">Pass / Fail reasons (mock)</div>
        <div className="mt-2 text-sm text-[var(--color-ink-soft)]">Reasons are not calculated in this mock. They will appear here after the deliberation engine is implemented.</div>
      </Card>
    </div>
  );
}
