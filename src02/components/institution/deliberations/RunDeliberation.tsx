"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { availableRulesForInstitution, addRun } from "@/lib/mockData/deliberations";
import { findRulesForInstitution } from "@/lib/mockData/admissionRules";
import { Card, RowAction } from "@/components/ui";
import { Field, SelectInput, TextArea, PrimaryButton } from "@/components/Form";

export default function RunDeliberation({ institutionId }: { institutionId: string }) {
  const router = useRouter();
  const rules = findRulesForInstitution(institutionId);
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [versionId, setVersionId] = useState(rules[0]?.latestVersion.id ?? "");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  function run() {
    if (!ruleId || !versionId) return;
    // create mock run
    addRun(institutionId, ruleId, versionId, notes || undefined);
    router.push("/institution/deliberations");
  }

  const selectedRule = rules.find((r) => r.id === ruleId);

  return (
    <div className="space-y-4">
      <Card>
        <Field label="Admission rule">
          <SelectInput value={ruleId} onChange={(e) => { setRuleId(e.target.value); const r = rules.find(rr=>rr.id===e.target.value); setVersionId(r?.latestVersion.id ?? ""); }}>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Rule version">
          <SelectInput value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            {selectedRule?.versions.map((v) => (
              <option key={v.id} value={v.id}>{v.id} — {new Date(v.createdAt).toLocaleDateString()}</option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Notes (optional)">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="flex items-center gap-3">
          <PrimaryButton onClick={() => setConfirming(true)}>Run deliberation</PrimaryButton>
          <RowAction onClick={() => { setRuleId(""); setVersionId(""); setNotes(""); }}>Reset</RowAction>
        </div>
      </Card>

      {confirming && (
        <Card>
          <div className="text-sm">Are you sure you want to run the deliberation with rule <strong>{selectedRule?.name}</strong> (version {versionId})?</div>
          <div className="mt-3 flex items-center gap-3">
            <PrimaryButton onClick={run}>Confirm and run</PrimaryButton>
            <RowAction onClick={() => setConfirming(false)}>Cancel</RowAction>
          </div>
        </Card>
      )}
    </div>
  );
}
