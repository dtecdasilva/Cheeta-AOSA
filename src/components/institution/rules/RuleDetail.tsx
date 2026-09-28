"use client";

import { AdmissionRule, addRuleVersion } from "@/lib/mockData/admissionRules";
import { Card } from "@/components/ui";

export default function RuleDetail({ rule }: { rule: AdmissionRule }) {
  if (!rule) return <Card padded={true}>Rule not found.</Card>;

  return (
    <div className="space-y-4">
      <Card padded={true}>
        <div className="font-medium">{rule.name}</div>
        {rule.description && <div className="text-sm text-[var(--color-ink-soft)]">{rule.description}</div>}
        <div className="mt-3 text-xs text-[var(--color-ink-soft)]">Latest version: {rule.latestVersion.id}</div>
      </Card>

      <Card>
        <div className="text-sm">Condition:</div>
        <pre className="mt-2 text-xs">{JSON.stringify(rule.latestVersion.condition, null, 2)}</pre>
      </Card>
    </div>
  );
}
